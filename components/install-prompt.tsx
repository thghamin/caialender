"use client";

import { useEffect, useState } from "react";
import { Hobanu } from "./hobanu";
import { detectInApp } from "@/lib/client/in-app";

// 휴대폰에서 로그인하면 'C:AI:ender 앱 설치'를 권한다. 설치해야(특히 아이폰) 휴대폰 알림을 받을 수 있다.
// - 안드로이드 크롬: beforeinstallprompt로 [앱 설치] 한 번에 설치
// - 아이폰(Safari·크롬): 설치 API가 없어 '공유 → 홈 화면에 추가' 안내
// [닫기]는 지금 창(세션)에서만 숨기고, 창을 다시 열면 또 묻는다.
// '오늘 하루 보지 않기'를 체크하고 닫으면 오늘 밤 12시(KST)까지 묻지 않는다. 이미 앱으로 열었으면 묻지 않는다.

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const TODAY_KEY = "install_prompt_hide_until"; // localStorage: 이 시각(ms)까지 숨김
const SESSION_KEY = "install_prompt_closed"; // sessionStorage: 이번 창에서 닫음

/** 오늘 밤 12시(KST) */
function endOfTodayKst() {
  const kst = new Date(Date.now() + 9 * 3600_000);
  return Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() + 1) - 9 * 3600_000;
}

function shouldAsk() {
  if (!window.matchMedia("(max-width: 767px)").matches) return false; // 휴대폰 화면에서만
  if (detectInApp(navigator.userAgent)) return false; // 카카오톡 등 앱 안의 브라우저는 설치가 안 된다 (InAppGuard가 안내)
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
  if (standalone) return false;
  if (sessionStorage.getItem(SESSION_KEY)) return false;
  return Date.now() >= Number(localStorage.getItem(TODAY_KEY) ?? 0);
}

export function InstallPrompt() {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android">("android");
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [done, setDone] = useState(false);
  const [hideToday, setHideToday] = useState(false);

  useEffect(() => {
    if (!shouldAsk()) return;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    // 설치 가능 판정에 서비스 워커가 필요하므로 미리 등록 (알림 켤 때도 같은 것을 쓴다)
    navigator.serviceWorker?.register("/sw.js").catch(() => {});
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    // 첫 화면이 다 그려진 뒤에 띄운다
    const t = setTimeout(() => {
      setPlatform(ios ? "ios" : "android");
      setOpen(true);
    }, 1200);
    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, []);

  if (!open) return null;
  const close = () => {
    sessionStorage.setItem(SESSION_KEY, "1");
    if (hideToday) localStorage.setItem(TODAY_KEY, String(endOfTodayKst()));
    setOpen(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-[68px] z-40 px-3 pb-2 md:hidden" role="dialog" aria-label="앱 설치 안내">
      <div className="animate-pop-in rounded-2xl border border-brand/20 bg-white p-4 shadow-2xl shadow-black/20">
        <div className="flex items-start gap-3">
          <Hobanu className="size-12 shrink-0" title="" />
          <div className="min-w-0 flex-1">
            <p className="font-bold">C:AI:ender 앱으로 설치할까요?</p>
            <p className="mt-0.5 text-sm leading-5 text-zinc-600">
              {done ? "설치했어요! 홈 화면의 앱을 열고 내 캘린더에서 🔔 알림을 켜 주세요." : "앱으로 설치하면 일정 하루 전·수업 10분 전 알림을 받을 수 있어요."}
            </p>
          </div>
        </div>

        {!done && platform === "ios" && (
          <ol className="mt-3 space-y-1.5 rounded-xl bg-brand-soft p-3 text-sm">
            <li>
              1. 화면 아래(크롬은 주소창 옆)의 <b>공유 버튼</b> <span className="rounded border border-zinc-300 bg-white px-1">□↑</span> 누르기
            </li>
            <li>
              2. <b>홈 화면에 추가</b> 누르기
            </li>
            <li>3. 홈 화면의 C:AI:ender 앱으로 열기</li>
          </ol>
        )}
        {!done && platform === "android" && !installEvent && (
          <p className="mt-3 rounded-xl bg-brand-soft p-3 text-sm">
            크롬 오른쪽 위 <b>⋮ 메뉴 → 앱 설치</b>(또는 <b>홈 화면에 추가</b>)를 눌러 주세요.
          </p>
        )}

        <div className="mt-3 flex items-center justify-end gap-2">
          <label className="mr-auto flex items-center gap-1.5 text-sm text-zinc-500">
            <input type="checkbox" checked={hideToday} onChange={(e) => setHideToday(e.target.checked)} className="size-4 accent-brand" />
            오늘 하루 보지 않기
          </label>
          <button onClick={close} className="rounded-full px-4 py-2 text-sm text-zinc-500">
            닫기
          </button>
          {!done && platform === "android" && installEvent && (
            <button
              onClick={async () => {
                await installEvent.prompt();
                const { outcome } = await installEvent.userChoice;
                setInstallEvent(null);
                if (outcome === "accepted") setDone(true);
              }}
              className="rounded-full bg-brand px-5 py-2 text-sm font-bold text-white"
            >
              앱 설치
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
