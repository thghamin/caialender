import { NextResponse, type NextRequest } from "next/server";
import { drainQueue } from "@/lib/jobs/analyze-notice";
import { sendDueReminders } from "@/lib/jobs/send-reminders";

export const maxDuration = 300;

/**
 * 대기 중이거나 실패 후 재시도할 공지 분석 작업을 처리한다.
 * Supabase pg_cron이 1분마다 호출 (Authorization: Bearer CRON_SECRET)
 * 같은 1분 작업에서 휴대폰 알림(일정 하루 전, 수업 10분 전)도 보낸다. 시간이 중요하므로 먼저 보낸다.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const reminders = await sendDueReminders().catch((e) => {
    console.error("[reminders] 실패:", e);
    return { sent: 0, error: String(e) };
  });
  const results = await drainQueue(240_000);
  return NextResponse.json({ processed: results.length, results, reminders });
}
