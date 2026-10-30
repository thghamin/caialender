import "server-only";
import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/server";

export type PushMessage = { title: string; body: string; url: string; tag?: string };

let configured = false;
export function pushConfigured() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  if (!configured) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://caialender.vercel.app", pub, priv);
    configured = true;
  }
  return true;
}

/** 한 사용자의 모든 기기로 보낸다. 만료된 구독(404/410)은 지운다. 보낸 기기 수를 돌려준다 */
export async function sendPushToUser(userId: string, msg: PushMessage) {
  if (!pushConfigured()) throw new Error("VAPID 키가 설정되지 않았습니다.");
  const db = createServiceClient();
  const { data: subs } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId);
  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(msg),
        { TTL: 3600, urgency: "high" },
      );
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await db.from("push_subscriptions").delete().eq("id", s.id);
      else console.error("[push] 전송 실패", status, (e as Error).message);
    }
  }
  return sent;
}
