import { getAdminMetrics } from "@/lib/metrics";
import { Card } from "@/components/ui";

const fmt = (v: number | null, unit = "", digits = 0) => (v === null ? "-" : `${v.toFixed(digits)}${unit}`);

/** 📊 AI·학생회 성과: 실제 기록만으로 계산 */
export async function MetricsCard() {
  const m = await getAdminMetrics();
  const tiles: { label: string; value: string; sub: string }[] = [
    { label: "AI가 분석한 공지", value: `${m.notices}건`, sub: `분석 성공률 ${fmt(m.analyzeSuccessPct, "%")}` },
    { label: "공지 1건 분석 시간", value: fmt(m.avgAnalyzeSec, "초", 1), sub: "등록 → 일정 초안까지 평균" },
    { label: "AI가 대신 입력한 일정", value: `${m.aiEvents}개`, sub: `게시 ${m.publishedAi}개` },
    { label: "수정 없이 게시", value: fmt(m.publishedAsIsPct, "%"), sub: "게시된 AI 초안 중 고치지 않은 비율" },
    { label: "근거 문장 원문 일치", value: fmt(m.evidenceVerifiedPct, "%"), sub: `AI가 인용한 근거 ${m.evidenceChecked}개 중` },
    { label: "누락 정보 알림", value: `${m.missingFlagged}개`, sub: "장소·시간 등이 빠진 일정을 표시" },
    { label: "일정 변경 감지", value: `${m.changesDetected}건`, sub: `반영 ${m.changesApplied}건` },
    { label: "학생 질문 답변", value: fmt(m.answeredPct, "%"), sub: `질문 ${m.questions}개 · 평균 ${fmt(m.avgAnswerHours, "시간", 1)}` },
    { label: "학생 참여", value: `${m.interests}회`, sub: `내 캘린더 담기 · 알림 ${m.reminders}개` },
  ];
  return (
    <Card>
      <h2 className="mb-3 font-semibold">📊 AI·학생회 성과 <span className="text-xs font-normal text-zinc-500">(실제 기록 기준)</span></h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl bg-brand-soft/60 p-3">
            <p className="text-xs text-zinc-600">{t.label}</p>
            <p className="text-xl font-extrabold text-brand">{t.value}</p>
            <p className="text-[11px] leading-4 text-zinc-500">{t.sub}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
