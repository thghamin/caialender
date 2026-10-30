"use client";

import { useEffect, useState, useTransition } from "react";
import { removePushSubscription, savePushSubscription, sendTestPush } from "@/app/notifications/actions";

type Status = "checking" | "unsupported" | "ios-install" | "denied" | "off" | "on";

function base64ToBytes(base64: string) {
  const s = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function currentStatus(): Promise<Status> {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return ios && !standalone ? "ios-install" : "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

/** 이 기기(휴대폰·PC 브라우저)를 알림 받을 기기로 등록. 아이폰은 홈 화면에 추가한 앱에서만 된다 */
export function PushSetup() {
  const [status, setStatus] = useState<Status>("checking");
  const [msg, setMsg] = useState<string>();
  const [pending, start] = useTransition();

  useEffect(() => {
    let alive = true;
    currentStatus().then((s) => alive && setStatus(s));
    return () => {
      alive = false;
    };
  }, []);

  const enable = () =>
    start(async () => {
      setMsg(undefined);
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64ToBytes(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""),
        }));
      const r = await savePushSubscription(sub.toJSON(), navigator.userAgent);
      if (r.error) setMsg(r.error);
      else setStatus("on");
    });

  const disable = () =>
    start(async () => {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("off");
    });

  const test = () =>
    start(async () => {
      const r = await sendTestPush();
      setMsg(r.error ?? "테스트 알림을 보냈어요. 잠시 후 알림이 뜨는지 확인해 보세요.");
    });

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">
          🔔 휴대폰 알림{" "}
          <span className={status === "on" ? "text-emerald-700" : "text-zinc-500"}>
            {status === "on" ? "켜짐 (이 기기)" : status === "checking" ? "확인 중…" : "꺼짐"}
          </span>
        </span>
        {status === "off" && (
          <button onClick={enable} disabled={pending} className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
            {pending ? "설정 중…" : "이 기기에서 알림 받기"}
          </button>
        )}
        {status === "on" && (
          <span className="flex gap-1.5">
            <button onClick={test} disabled={pending} className="rounded-full border border-brand/40 px-3 py-1.5 text-xs font-semibold text-brand disabled:opacity-50">
              테스트 알림
            </button>
            <button onClick={disable} disabled={pending} className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 disabled:opacity-50">
              끄기
            </button>
          </span>
        )}
      </div>
      {status === "ios-install" && (
        <p className="rounded-lg bg-brand-soft p-2 text-xs leading-5">
          아이폰은 <b>Safari 아래 공유 버튼(□↑) → 홈 화면에 추가</b>로 앱을 설치한 뒤, 홈 화면의 C:AI:ender 앱에서 알림을 켤 수 있어요.
        </p>
      )}
      {status === "denied" && (
        <p className="rounded-lg bg-amber-50 p-2 text-xs leading-5 text-amber-800">
          알림이 차단되어 있어요. 휴대폰(브라우저) 설정에서 이 사이트의 알림을 허용한 뒤 다시 열어 주세요.
        </p>
      )}
      {status === "unsupported" && <p className="text-xs text-zinc-500">이 브라우저는 알림을 지원하지 않아요. Chrome·Safari 최신 버전에서 열어 주세요.</p>}
      <p className="text-xs text-zinc-500">일정마다 🔔를 켜면 시작 24시간 전에, 시간표 수업은 10분 전에 알려 드려요.</p>
      {msg && <p className="text-xs text-brand">{msg}</p>}
    </div>
  );
}
