import { findEvidence } from "@/lib/ai/extract-schema";

/** 공지 원문에서 AI가 일정을 뽑은 근거 문장들을 형광펜으로 표시한다 */
export function EvidenceText({ body, evidences }: { body: string; evidences: (string | null)[] }) {
  const ranges = evidences
    .map((e) => findEvidence(body, e))
    .filter((r): r is { start: number; end: number } => !!r)
    .sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let at = 0;
  for (const r of ranges) {
    if (r.start < at) continue; // 겹치는 근거는 앞의 것만
    parts.push(body.slice(at, r.start));
    parts.push(
      <mark key={r.start} className="rounded bg-amber-200/70 px-0.5 text-inherit" title="AI가 일정을 뽑은 근거">
        {body.slice(r.start, r.end)}
      </mark>,
    );
    at = r.end;
  }
  parts.push(body.slice(at));
  return <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-zinc-700">{parts}</pre>;
}
