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
  it("라인은 주소에 openExternalBrowser=1을 붙여 바깥 브라우저로 연다", () => {
    const LINE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari Line/14.10.0";
    const app = detectInApp(LINE)!;
    expect(app.line).toBe(true);
    expect(externalOpenUrl(app, href)).toBe("https://caialender.vercel.app/my?x=1&openExternalBrowser=1");
  });
  it("밴드·스레드·네이버도 알아보고, 아이폰은 그 앱에서 누를 버튼을 순서대로 안내", () => {
    const BAND = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 BAND/16.0.0";
    const THREADS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Barcelona 330.0";
    expect(detectInApp(BAND)).toMatchObject({ name: "밴드", steps: ["오른쪽 위 ··· 버튼을 눌러요", "'기본 브라우저로 열기'를 눌러요"] });
    expect(detectInApp(THREADS)?.name).toBe("스레드");
    expect(externalOpenUrl(detectInApp(BAND)!, href)).toBeNull();
  });
  it("목록에 없는 앱 속 브라우저도 알아본다 (안드로이드 wv, 아이폰 Safari 표시 없음). 아이폰 크롬은 아니다", () => {
    const AOS_WV = "Mozilla/5.0 (Linux; Android 14; SM-S918N; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0 Mobile Safari/537.36";
    const IOS_WV = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
    const IOS_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0 Mobile/15E148 Safari/604.1";
    expect(detectInApp(AOS_WV)?.name).toBe("앱 속 브라우저");
    expect(externalOpenUrl(detectInApp(AOS_WV)!, href)).toContain("intent://");
    expect(detectInApp(IOS_WV)?.name).toBe("앱 속 브라우저");
    expect(detectInApp(IOS_CHROME)).toBeNull();
  });
});
