import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getBriefing } from "@/lib/briefing";
import { getInterestIds, getPublishedEvents, pickMyEvents } from "@/lib/data/events";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const scope = request.nextUrl.searchParams.get("scope") === "me" ? "me" : "all";
  try {
    const events = await getPublishedEvents();
    if (scope === "all") {
      return NextResponse.json(await getBriefing({ userId: null, scopeLabel: "인공지능전공 전체 캘린더", events }));
    }
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const mine = pickMyEvents(events, user, await getInterestIds(user.id));
    return NextResponse.json(
      await getBriefing({ userId: user.id, scopeLabel: `${user.grade ?? ""}학년 학생 ${user.name}의 내 캘린더`, events: mine }),
    );
  } catch (e) {
    console.error("[briefing] 실패:", e);
    return NextResponse.json({ error: "지금은 AI 브리핑을 만들 수 없어요. 캘린더에서 일정을 확인해 주세요." }, { status: 503 });
  }
}
