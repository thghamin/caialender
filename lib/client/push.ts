// 이 기기를 알림 받을 기기로 등록 (권한 요청 → 서비스 워커 → 구독 저장). 알림 설정 화면과 소통방 🔔에서 같이 쓴다
import { savePushSubscription } from "@/app/notifications/actions";

function base64ToBytes(base64: string) {
  const s = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

export type PushResult = "on" | "denied" | "unsupported" | "ios-install" | "off" | "error";

export async function ensurePushSubscription(): Promise<PushResult> {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return ios && !standalone ? "ios-install" : "unsupported";
  }
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "") }));
    const r = await savePushSubscription(sub.toJSON(), navigator.userAgent);
    return r.error ? "error" : "on";
  } catch {
    return "error";
  }
}

/** 기기 알림이 안 될 때 안내 문구 */
export function pushHint(r: PushResult): string | null {
  if (r === "on") return null;
  if (r === "ios-install") return "아이폰은 홈 화면에 추가한 앱에서만 알림을 받을 수 있어요. (공유 → 홈 화면에 추가)";
  if (r === "denied") return "이 기기에서 알림이 차단되어 있어요. 브라우저 설정에서 알림을 허용해 주세요.";
  if (r === "unsupported") return "이 브라우저는 알림을 지원하지 않아요.";
  return "기기 알림을 켜지 못했어요. 내 캘린더의 알림 설정에서 다시 시도해 주세요.";
}
