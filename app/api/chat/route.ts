import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { AIError, streamText, type ChatMessage, type ContentPart } from "@/lib/ai/provider";
import { buildNoticeChatSystemPrompt } from "@/lib/ai/prompts";
import { kstDate } from "@/lib/datetime";
import type { CalendarEvent, Notice } from "@/lib/types";

export const maxDuration = 60;

const HOURLY_LIMIT = 30;

const bodySchema = z.object({
  noticeId: z.uuid(),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) }))
    .min(1)
    .max(12),
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  const { noticeId, messages } = parsed.data;
  const question = messages.at(-1)!;
  if (question.role !== "user" || !question.content.trim()) {
    return NextResponse.json({ error: "질문을 입력하세요." }, { status: 400 });
  }

  const supabase = await createClient();
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await supabase
    .from("chat_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", since);
  if ((count ?? 0) >= HOURLY_LIMIT) {
    return NextResponse.json({ error: `질문은 1시간에 ${HOURLY_LIMIT}개까지 할 수 있어요.` }, { status: 429 });
  }

  const { data: notice } = await supabase.from("notices").select("*").eq("id", noticeId).maybeSingle<Notice>();
  if (!notice) return NextResponse.json({ error: "공지를 찾을 수 없습니다." }, { status: 404 });
  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("notice_id", noticeId)
    .eq("status", "published")
    .order("start_at");

  const system = buildNoticeChatSystemPrompt({
    today: kstDate(new Date().toISOString()),
    notice,
    events: (events ?? []) as CalendarEvent[],
    hasImage: Boolean(notice.image_path),
  });

  // 본문 없이 포스터만 있는 공지는 이미지도 함께 보낸다
  const history: ChatMessage[] = messages.map((m) => ({ role: m.role, content: m.content }));
  if (notice.image_path && !notice.body) {
    const { data: blob } = await createServiceClient().storage.from("posters").download(notice.image_path);
    if (blob) {
      const url = `data:${blob.type || "image/jpeg"};base64,${Buffer.from(await blob.arrayBuffer()).toString("base64")}`;
      const first = history.findIndex((m) => m.role === "user");
      history[first] = {
        role: "user",
        content: [{ type: "image_url", image_url: { url } }, { type: "text", text: messages[first].content }] as ContentPart[],
      };
    }
  }

  const { data: log } = await supabase
    .from("chat_logs")
    .insert({ user_id: user.id, notice_id: noticeId, question: question.content })
    .select("id")
    .single();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let answer = "";
      let error: string | null = null;
      try {
        for await (const delta of streamText({ messages: [{ role: "system", content: system }, ...history], maxTokens: 600 })) {
          answer += delta;
          controller.enqueue(encoder.encode(delta));
        }
        if (!answer) throw new AIError("빈 응답", true);
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
        console.error("[chat] AI 오류:", error);
        controller.enqueue(encoder.encode(answer ? "\n\n(응답이 중간에 끊겼어요.)" : "\u0000AI 서비스에 일시적인 문제가 있어요. 잠시 후 다시 시도해 주세요. 공지 원문과 캘린더는 계속 볼 수 있어요."));
      } finally {
        if (log) await supabase.from("chat_logs").update({ answer, error }).eq("id", log.id);
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
