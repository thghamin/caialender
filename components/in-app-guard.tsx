"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { detectInApp, externalOpenUrl } from "@/lib/client/in-app";

const AUTO_KEY = "inapp_auto_opened";

/** 앱 안의 브라우저(카카오톡 등)로 열면 Safari/크롬으로 열도록 안내. 카카오톡은 처음 한 번 자동으로 바깥 브라우저를 연다 */
export function InAppGuard() {
  // 브라우저 종류는 바뀌지 않으므로 구독할 것은 없다. 서버에서는 null (안내 없음)
  const ua = useSyncExternalStore(
    () => () => {},
    () => navigator.userAgent,
    () => "",
  );
  const app = ua ? detectInApp(ua) : null;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const found = ua ? detectInApp(ua) : null;
    if (!found?.kakao) return;
    const url = externalOpenUrl(found, window.location.href);
    if (url && !sessionStorage.getItem(AUTO_KEY)) {
      sessionStorage.setItem(AUTO_KEY, "1");
      window.location.href = url;
    }
  }, [ua]);

  if (!app) return null;
  const url = typeof window !== "undefined" ? externalOpenUrl(app, window.location.href) : null;
  // 아이폰은 Safari, 안드로이드 카카오톡은 기본 브라우저(크롬·삼성 인터넷 등), 안드로이드 다른 앱은 크롬으로 연다
  const browser = app.ios ? "Safari" : app.kakao ? "크롬·삼성 인터넷 같은 브라우저" : "크롬";
  const button = app.ios ? "Safari로 열기" : app.kakao ? "브라우저로 열기" : "크롬으로 열기";

  return (
    <div className="sticky top-0 z-50 bg-zinc-900 px-3 py-2.5 text-white" role="alert" aria-label="외부 브라우저 안내">
      <p className="text-sm leading-5">
        <b>{app.name}</b> 안에서는 앱 설치와 알림이 안 돼요. <b>{browser}</b>로 열어 주세요.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {url ? (
          <a href={url} className="rounded-full bg-white px-4 py-1.5 text-sm font-bold text-zinc-900">
            {button}
          </a>
        ) : (
          <span className="text-xs text-zinc-300">오른쪽 아래(또는 위) <b>··· 메뉴 → Safari로 열기</b>를 눌러 주세요.</span>
        )}
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard?.writeText(window.location.href).catch(() => {});
            setCopied(true);
          }}
          className="rounded-full border border-white/40 px-3 py-1.5 text-xs"
        >
          {copied ? "복사했어요 — 주소창에 붙여넣기" : "링크 복사"}
        </button>
      </div>
    </div>
  );
}
