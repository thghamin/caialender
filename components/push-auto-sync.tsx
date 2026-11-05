"use client";

import { useEffect } from "react";
import { ensurePushSubscription } from "@/lib/client/push";

const KEY = "push_synced";

/**
 * 알림을 이미 허용한 기기는 앱을 열 때(탭마다 한 번) 이 기기의 구독을 서버에 다시 맞춘다.
 * 아이폰에서 홈 화면 앱을 지우고 다시 추가했거나 구독이 바뀐 경우에도, 버튼을 다시 누르지 않아도 알림이 온다.
 * 허용 전이면 아무것도 하지 않는다(권한 요청 창을 띄우지 않음).
 */
export function PushAutoSync() {
  useEffect(() => {
    if (!("Notification" in window) || Notification.permission !== "granted" || sessionStorage.getItem(KEY)) return;
    sessionStorage.setItem(KEY, "1");
    ensurePushSubscription().catch(() => {});
  }, []);
  return null;
}
