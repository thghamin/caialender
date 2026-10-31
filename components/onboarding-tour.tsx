"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Hobanu } from "./hobanu";

// 처음 들어온 학생에게 화면 요소를 하나씩 비추며 소개하는 둘러보기 (학과 캘린더 첫 화면에서).
// - 한 번 끝내거나 '그만 보기'·✕를 누르면 이 기기에서는 다시 띄우지 않는다
// - 아래쪽 '사용법 다시 보기'(/?tour=1)로 언제든 다시 볼 수 있다
// - 휴대폰은 하단 탭, PC는 위쪽 메뉴를 비춘다 (보이는 요소만 골라서)

type Step = { target: string; title: string; body: string };

const STEPS: Step[] = [
  {
    target: '[data-tour="calendar"]',
    title: "학과 캘린더",
    body: "학생회가 올린 행사·마감이 여기 모여요. 일정을 누르면 ☆ 내 캘린더에 담고, 하루 전·1시간 전 알림도 켤 수 있어요.",
  },
  {
    target: '[data-tour="briefing"]',
    title: "AI 주간 브리핑",
    body: "이번 주 꼭 챙길 일정을 AI가 한눈에 정리해 줘요.",
  },
  {
    target: '[data-tour="tabs"], [data-tour="nav"]',
    title: "캘린더 3개",
    body: "학과 캘린더 · 학사 캘린더(경북대 학사일정) · 내 캘린더(담은 일정 + 개인 일정)를 오가며 볼 수 있어요.",
  },
  {
    target: '[data-tour="tab-timetable"], [data-tour="nav"] a[href="/timetable"]',
    title: "내 시간표",
    body: "에브리타임 시간표 캡처 한 장이면 시간표가 완성돼요. 수업 10분 전에 알림도 와요.",
  },
  {
    target: '[data-tour="tab-more"], [data-tour="nav"] a[href="/qna"]',
    title: "공지 · 질문 · 검색",
    body: "학생회 공지를 보고, 궁금한 건 질문으로 남기면 답이 달릴 때 알려 줘요.",
  },
];

const DONE_KEY = "caialender_tour_done_v1";
export const TOUR_DONE_EVENT = "caialender:tour-done";

/** 화면에 실제로 보이는 첫 요소 */
function findVisible(selector: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(selector)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden") return el;
  }
  return null;
}

export function OnboardingTour() {
  const router = useRouter();
  const params = useSearchParams();
  const forced = params.get("tour") === "1";
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // 시작 여부: 처음이거나 '다시 보기'로 들어왔을 때. 자동화 브라우저(테스트)에서는 '다시 보기'로만 띄운다
  useEffect(() => {
    if (!forced && (localStorage.getItem(DONE_KEY) || navigator.webdriver)) return;
    // 화면(달력·브리핑)이 그려진 뒤 시작
    const t = setTimeout(() => {
      const available = STEPS.filter((s) => findVisible(s.target));
      if (!available.length) return;
      document.documentElement.dataset.tour = "open";
      setSteps(available);
      setIndex(0);
    }, 600);
    return () => clearTimeout(t);
  }, [forced]);

  const step = steps?.[index];

  // 비출 요소를 화면 가운데로 옮기고 위치를 잰다 (스크롤·화면 크기 변화에도 따라간다)
  const measure = useCallback(() => {
    const el = step && findVisible(step.target);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step]);
  useEffect(() => {
    const el = step && findVisible(step.target);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const raf = requestAnimationFrame(measure);
    const t = setTimeout(measure, 350); // 부드러운 스크롤이 끝난 뒤 한 번 더
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, [step, measure]);

  const finish = useCallback(() => {
    localStorage.setItem(DONE_KEY, "1");
    delete document.documentElement.dataset.tour;
    setSteps(null);
    window.dispatchEvent(new Event(TOUR_DONE_EVENT));
    if (forced) router.replace("/", { scroll: false });
  }, [forced, router]);

  useEffect(() => {
    if (!steps) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight" || e.key === "Enter") setIndex((i) => (i + 1 < steps.length ? i + 1 : i));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps, finish]);

  if (!steps || !step) return null;
  const last = index === steps.length - 1;
  const pad = 6;
  // 설명 상자는 비춘 요소의 아래(공간이 없으면 위)에
  const vh = typeof window === "undefined" ? 800 : window.innerHeight;
  const below = !rect || rect.bottom + 220 < vh || rect.top < 240;
  const cardStyle: React.CSSProperties = rect
    ? below
      ? { top: Math.min(rect.bottom + pad + 12, vh - 230) }
      : { bottom: vh - rect.top + pad + 12 }
    : { top: "50%", transform: "translateY(-50%)" };

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="서비스 둘러보기">
      {/* 바깥을 누르면 아무 일도 없게 (실수로 일정이 눌리지 않도록) */}
      <div className="absolute inset-0" />
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-2xl ring-2 ring-white transition-all duration-300"
          style={{
            left: rect.left - pad,
            top: rect.top - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.6)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/60" />
      )}
      <div
        className="animate-pop-in absolute inset-x-3 mx-auto max-w-sm rounded-3xl bg-white p-4 shadow-2xl"
        style={cardStyle}
        key={index}
      >
        <div className="flex items-start gap-3">
          <div className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-soft">
            <Hobanu className="size-10" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-brand">
              {index + 1} / {steps.length}
            </p>
            <h2 className="text-lg font-extrabold tracking-tight">{step.title}</h2>
          </div>
          <button onClick={finish} aria-label="둘러보기 닫기" className="-mr-1 -mt-1 grid size-9 place-items-center rounded-full text-xl text-zinc-400 hover:bg-zinc-100">
            ×
          </button>
        </div>
        <p className="mt-2 text-[15px] leading-relaxed text-zinc-600">{step.body}</p>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={finish} className="shrink-0 whitespace-nowrap rounded-full px-1 py-2 text-sm font-semibold text-zinc-500 hover:text-zinc-800">
            그만 보기
          </button>
          <div className="flex min-w-0 flex-1 justify-center gap-1.5" aria-hidden>
            {steps.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-brand" : "w-1.5 bg-zinc-300"}`} />
            ))}
          </div>
          {index > 0 && (
            <button onClick={() => setIndex(index - 1)} className="shrink-0 whitespace-nowrap rounded-full px-3 py-2.5 text-sm font-semibold text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50">
              이전
            </button>
          )}
          <button
            onClick={() => (last ? finish() : setIndex(index + 1))}
            className="shrink-0 whitespace-nowrap rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-brand-dark"
          >
            {last ? "시작하기" : "다음"}
          </button>
        </div>
      </div>
    </div>
  );
}
