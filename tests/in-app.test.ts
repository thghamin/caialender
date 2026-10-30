import { describe, expect, it } from "vitest";
import { detectInApp, externalOpenUrl } from "@/lib/client/in-app";

const KAKAO_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.8.5";
const KAKAO_AOS = "Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36;KAKAOTALK 2410850";
const INSTA_AOS = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36 Instagram 330.0";
const INSTA_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 330.0";
const SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

describe("앱 안의 브라우저 감지", () => {
  const href = "https://caialender.vercel.app/my?x=1";
  it("카카오톡은 iOS·안드로이드 모두 외부 브라우저 전용 주소로 연다", () => {
    for (const ua of [KAKAO_IOS, KAKAO_AOS]) {
      const app = detectInApp(ua)!;
      expect(app.kakao).toBe(true);
      expect(externalOpenUrl(app, href)).toBe(`kakaotalk://web/openExternal?url=${encodeURIComponent(href)}`);
    }
  });
  it("안드로이드 다른 앱은 크롬 intent, 아이폰 다른 앱은 안내만", () => {
    expect(externalOpenUrl(detectInApp(INSTA_AOS)!, href)).toBe(
      "intent://caialender.vercel.app/my?x=1#Intent;scheme=https;package=com.android.chrome;end",
    );
    expect(externalOpenUrl(detectInApp(INSTA_IOS)!, href)).toBeNull();
  });
  it("Safari·크롬은 앱 안의 브라우저가 아니다", () => {
    expect(detectInApp(SAFARI)).toBeNull();
  });
});
