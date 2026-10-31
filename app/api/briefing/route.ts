import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getBriefing } from "@/lib/briefing";
import { getInterestIds, getPublishedEvents, pickRelevantEvents } from "@/lib/data/events";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const scope = request.nextUrl.searchParams.get("scope") === "me" ? "me" : "all";
  // 승인된 회원만 (브리핑 생성은 AI 비용이 들고, 일정은 회원 전용 정보)
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (user.approval_status !== "approved") return NextResponse.json({ error: "가입 승인 후 이용할 수 있어요." }, { status: 403 });
  try {
    if (scope === "all") {
      // 학과 캘린더 브리핑: 학생회가 올린 학과 일정만 (학사일정은 내 캘린더에 담은 것만 개인 브리핑에 들어간다)
      const events = await getPublishedEvents("dept");
      return NextResponse.json(await getBriefing({ userId: null, scopeLabel: "인공지능전공 학과 캘린더", events }));
    }
    const events = await getPublishedEvents();
    const mine = pickRelevantEvents(events, user, await getInterestIds(user.id));
    return NextResponse.json(
      await getBriefing({ userId: user.id, scopeLabel: `${user.grade ?? ""}학년 학생 ${user.name}의 내 캘린더`, events: mine }),
    );
  } catch (e) {
    console.error("[briefing] 실패:", e);
    return NextResponse.json({ error: "지금은 AI 브리핑을 만들 수 없어요. 캘린더에서 일정을 확인해 주세요." }, { status: 503 });
  }
}
