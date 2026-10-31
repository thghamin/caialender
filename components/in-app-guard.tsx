"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { detectInApp, externalOpenUrl } from "@/lib/client/in-app";

const AUTO_KEY = "inapp_auto_opened";
const DISMISS_KEY = "inapp_guide_dismissed";

/**
 * 앱 안의 브라우저(카카오톡·인스타그램·네이버·라인·밴드 등)로 열었을 때:
 * - 바로 옮길 수 있으면(카카오톡·라인, 안드로이드의 모든 앱) 처음 한 번 자동으로 Safari/크롬을 연다
 * - 아이폰의 다른 앱은 자동으로 못 옮기므로, 그 앱에서 누를 버튼을 순서대로 크게 안내하고 링크 복사도 준다
 */
export function InAppGuard() {
  // 브라우저 종류는 바뀌지 않으므로 구독할 것은 없다. 서버에서는 안내 없음
  const ua = useSyncExternalStore(
    () => () => {},
    () => navigator.userAgent,
    () => "",
  );
  const standalone = useSyncExternalStore(
    () => () => {},
    () => window.matchMedia("(display-mode: standalone)").matches || !!(navigator as { standalone?: boolean }).standalone,
    () => false,
  );
  const app = ua && !standalone ? detectInApp(ua) : null;
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const found = ua && !standalone ? detectInApp(ua) : null;
    if (!found) return;
    const url = externalOpenUrl(found, window.location.href);
    if (url && !sessionStorage.getItem(AUTO_KEY)) {
      sessionStorage.setItem(AUTO_KEY, "1");
      window.location.href = url;
    }
  }, [ua, standalone]);

  if (!app) return null;
  const url = typeof window !== "undefined" ? externalOpenUrl(app, window.location.href) : null;
  const browser = app.ios ? "Safari" : "크롬";
  const copy = async () => {
    await navigator.clipboard?.writeText(window.location.href).catch(() => {});
    setCopied(true);
  };

  // 바로 옮길 수 있는 경우: 위쪽 띠 + 버튼 (자동으로 안 열렸을 때 다시 누를 수 있게)
  if (url || dismissed || (typeof window !== "undefined" && sessionStorage.getItem(DISMISS_KEY))) {
    return (
      <div className="sticky top-0 z-50 bg-zinc-900 px-3 py-2.5 text-white" role="alert" aria-label="외부 브라우저 안내">
        <p className="text-[13px] leading-5">
          <b>{app.name}</b> 안에서는 앱 설치와 알림이 안 돼요. <b>{browser}</b>로 열어 주세요.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {url ? (
            <a href={url} className="rounded-full bg-white px-4 py-1.5 text-[13px] font-bold text-zinc-900">
              {browser}로 열기
            </a>
          ) : (
            <span className="text-[12px] text-zinc-300">{app.steps.join(" → ")}</span>
          )}
          <button type="button" onClick={copy} className="rounded-full border border-white/40 px-3 py-1.5 text-[12px]">
            {copied ? "복사했어요 — Safari 주소창에 붙여넣기" : "링크 복사"}
          </button>
        </div>
      </div>
    );
  }

  // 아이폰 + 자동으로 못 옮기는 앱: 화면 전체 안내 (처음 한 번, '이대로 볼게요'로 닫기)
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-label="Safari로 여는 방법">
      <div className="animate-pop-in w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
        <p className="text-[18px] font-extrabold leading-snug">Safari로 열어 주세요 🧭</p>
        <p className="mt-1 text-[13.5px] leading-relaxed text-zinc-600">
          지금은 <b>{app.name}</b> 안의 화면이라 <b>앱 설치와 알림</b>이 안 돼요. 아래 순서대로 Safari로 옮겨 주세요.
        </p>
        <ol className="mt-4 flex flex-col gap-2.5">
          {app.steps.map((s, i) => (
            <li key={i} className="flex items-start gap-3 rounded-2xl bg-zinc-50 px-3 py-2.5 text-[14px] leading-snug">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand text-[13px] font-bold text-white">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
          <li className="flex items-start gap-3 rounded-2xl bg-zinc-50 px-3 py-2.5 text-[14px] leading-snug">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand text-[13px] font-bold text-white">{app.steps.length + 1}</span>
            <span>Safari에서 열리면 아래 공유 버튼(□↑) → <b>홈 화면에 추가</b>하면 앱처럼 쓰고 알림도 받아요.</span>
          </li>
        </ol>
        <div className="mt-4 rounded-2xl border border-dashed border-zinc-300 p-3 text-[13px] text-zinc-600">
          메뉴가 안 보이면: <b>링크를 복사</b>한 뒤 Safari를 열어 주소창에 붙여넣으세요.
          <button type="button" onClick={copy} className="mt-2 w-full rounded-xl bg-zinc-900 py-2.5 text-[14px] font-bold text-white">
            {copied ? "✓ 복사했어요 — Safari 주소창에 붙여넣기" : "링크 복사"}
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            sessionStorage.setItem(DISMISS_KEY, "1");
            setDismissed(true);
          }}
          className="mt-3 w-full py-2 text-[13px] font-semibold text-zinc-400"
        >
          이대로 볼게요
        </button>
      </div>
    </div>
  );
}
