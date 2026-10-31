"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Hobanu } from "./hobanu";
import { markTourDone } from "@/app/tour/actions";

// 처음 들어온 학생에게 화면 요소를 하나씩 비추며 소개하는 둘러보기 (학과 캘린더 첫 화면에서).
// - 한 번 끝내거나 '그만 보기'·✕를 누르면 이 계정으로는 어느 기기에서도 다시 띄우지 않는다 (계정에 기록)
// - 아래쪽 '사용법 다시 보기'(/?tour=1)로 언제든 다시 볼 수 있다
// - 휴대폰은 하단 탭, PC는 위쪽 메뉴를 비춘다 (보이는 요소만 골라서)

/** target이 빈 문자열이면 특정 요소 없이 화면 가운데에 설명만 보여 준다 */
type Step = { target: string; title: string; body: string[] };

const STEPS: Step[] = [
  {
    target: '[data-tour="calendar"]',
    title: "학과 캘린더",
    body: [
      "학생회가 올린 행사·마감이 한눈에 보여요. (초록 = 행사, 빨강 = 마감)",
      "일정을 누르면 자세한 내용과 ☆ 내 캘린더에 추가 버튼이 나와요.",
      "담은 일정은 하루 전·1시간 전 알림을 따로 켤 수 있어요.",
    ],
  },
  {
    target: '[data-tour="briefing"]',
    title: "AI 주간 브리핑",
    body: ["이번 주 일정과 마감을 AI가 짧게 정리해 줘요.", "학생회가 게시한 일정만으로 만들어서 믿고 볼 수 있어요."],
  },
  {
    target: '[data-tour="tab-academic"], [data-tour="nav"] a[href="/academic"]',
    title: "학사 캘린더",
    body: [
      "개강·수강신청·시험·휴학 접수 같은 경북대 공식 학사일정이에요.",
      "'대학원 일정도 보기'를 체크하면 대학원 일정까지 보여요.",
      "필요한 일정은 눌러서 ☆ 내 캘린더에 담아요.",
    ],
  },
  {
    target: '[data-tour="tab-my"], [data-tour="nav"] a[href="/my"]',
    title: "내 캘린더",
    body: [
      "☆로 담은 일정과 내 개인 일정만 모여요. (처음엔 비어 있어요)",
      "개인 일정은 날짜·시간을 골라 추가하고, 담은 일정과 겹치면 알려 줘요.",
      "🎨 내 색을 고르면 앱 전체 색이 바뀌어요.",
    ],
  },
  {
    target: '[data-tour="tab-timetable"], [data-tour="nav"] a[href="/timetable"]',
    title: "내 시간표",
    body: [
      "+ 수업 추가로 직접 넣거나, 📷 에브리타임 캡처를 올리면 AI가 채워 줘요.",
      "캡처는 라이트 모드(흰 바탕)로! 읽은 이름은 추가하기 전에 고칠 수 있어요.",
      "수업마다 10분 전 알림을 켤 수 있어요.",
    ],
  },
  {
    target: '[data-tour="tab-chat"], [data-tour="nav"] a[href="/chat"]',
    title: "학년별 소통방",
    body: [
      "1~4학년 방을 골라 휴강·시험 범위·과제·진도 정보를 나눠요. 다른 학생에겐 닉네임만 보여요.",
      "메시지마다 ↩ 답장, 문제가 되는 글은 신고하면 학생회가 확인해요.",
      "방 이름 옆 🔔로 새 메시지 알림을 켜고 끌 수 있어요. (기본은 꺼짐)",
    ],
  },
  {
    target: '[data-tour="more"], [data-tour="nav"] a[href="/qna"]',
    title: "공지 · 질문 · 검색",
    body: [
      "공지: 학생회 공지 원문과 AI가 뽑은 일정을 볼 수 있어요.",
      "질문: 남기면 학생회가 답하고, 답이 달리면 알려 줘요.",
      "검색: 일정·공지·질문을 한 번에 찾아요. (휴대폰은 오른쪽 위 ☰ 더보기)",
    ],
  },
  {
    target: '[data-tour="more"], [data-tour="nav"] a[href="/cafeteria"]',
    title: "공식당 메뉴",
    body: [
      "공학관 학생식당의 중식·석식 메뉴와 가격을 요일별로 봐요. (휴대폰은 ☰ 더보기 → 공식당 메뉴)",
      "‹ › 화살표로 지난 주부터 다음 주까지 넘겨 볼 수 있어요.",
      "★는 돼지고기가 들어간 메뉴예요. 새 메뉴가 올라오면 자동으로 바뀌어요.",
    ],
  },
  {
    target: "",
    title: "알림 받기",
    body: [
      "휴대폰은 앱처럼 설치해야 알림이 와요. 아이폰: Safari 공유 → 홈 화면에 추가 · 안드로이드: 크롬 메뉴 → 앱 설치",
      "그다음 내 캘린더나 시간표 화면의 '알림 받기'를 눌러 허용하세요.",
      "이 사용법은 맨 아래 '사용법 다시 보기'로 언제든 다시 볼 수 있어요.",
    ],
  },
];

const DONE_KEY = "caialender_tour_done_v1";
export const TOUR_DONE_EVENT = "caialender:tour-done";

/** 화면에 실제로 보이는 첫 요소 */
function findVisible(selector: string): HTMLElement | null {
  if (!selector) return null; // 비출 요소 없이 가운데에 보여 주는 단계
  for (const el of document.querySelectorAll<HTMLElement>(selector)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden") return el;
  }
  return null;
}

/** accountDone: 이 계정이 이미 둘러보기를 봤는지 (서버가 로그인 정보로 알려 준다) */
export function OnboardingTour({ accountDone }: { accountDone: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const forced = params.get("tour") === "1";
  const auto = params.get("tour") === "auto"; // 테스트용: 자동화 브라우저에서도 '처음 들어온 것처럼' 판단
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // 시작 여부: 처음이거나 '다시 보기'로 들어왔을 때. 자동화 브라우저(테스트)에서는 '다시 보기'로만 띄운다
  useEffect(() => {
    if (!forced) {
      if (accountDone) return;
      // 이 기기에서 이미 닫았으면(계정 기록 전 버전) 계정에도 남기고 띄우지 않는다
      if (localStorage.getItem(DONE_KEY)) return void markTourDone();
      if (navigator.webdriver && !auto) return;
    }
    // 화면(달력·브리핑)이 그려진 뒤 시작
    const t = setTimeout(() => {
      const available = STEPS.filter((s) => !s.target || findVisible(s.target));
      if (!available.length) return;
      document.documentElement.dataset.tour = "open";
      setSteps(available);
      setIndex(0);
    }, 600);
    return () => clearTimeout(t);
  }, [forced, auto, accountDone]);

  const step = steps?.[index];

  // 비출 요소를 화면 가운데로 옮기고 위치를 잰다 (스크롤·화면 크기 변화에도 따라간다)
  const measure = useCallback(() => {
    const el = step && findVisible(step.target);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step]);
  useEffect(() => {
    const el = step && findVisible(step.target);
    if (!el) {
      // 비출 요소가 없는 단계: 이전 단계의 강조를 지우고 가운데에 설명만
      const raf = requestAnimationFrame(measure);
      return () => cancelAnimationFrame(raf);
    }
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
    void markTourDone();
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
  const below = !rect || rect.bottom + 320 < vh || rect.top < 320;
  const cardStyle: React.CSSProperties = rect
    ? below
      ? { top: Math.min(rect.bottom + pad + 12, vh - 330) }
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
        <ul className="mt-2 flex flex-col gap-1.5 text-[14px] leading-snug text-zinc-600">
          {step.body.map((line, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>
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
