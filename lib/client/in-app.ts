// 카카오톡·인스타그램·네이버 앱 등 '앱 안의 브라우저' 감지.
// 이런 브라우저에서는 홈 화면에 추가(앱 설치)와 알림이 되지 않아 Safari/크롬으로 열어야 한다.
export type InApp = { name: string; kakao: boolean; ios: boolean; android: boolean } | null;

const APPS: [RegExp, string][] = [
  [/KAKAOTALK/i, "카카오톡"],
  [/NAVER\(inapp|NAVER\//i, "네이버 앱"],
  [/Instagram/i, "인스타그램"],
  [/FBAN|FBAV|FB_IAB/i, "페이스북"],
  [/\bLine\//i, "라인"],
  [/DaumApps/i, "다음 앱"],
  [/everytimeApp/i, "에브리타임"],
];

export function detectInApp(ua: string): InApp {
  const hit = APPS.find(([re]) => re.test(ua));
  if (!hit) return null;
  return { name: hit[1], kakao: hit[1] === "카카오톡", ios: /iphone|ipad|ipod/i.test(ua), android: /android/i.test(ua) };
}

/** 지금 주소를 바깥 브라우저(Safari/크롬)로 여는 주소. 없으면 null (아이폰의 카카오 외 앱) */
export function externalOpenUrl(app: NonNullable<InApp>, href: string): string | null {
  // 카카오톡은 iOS·안드로이드 모두 외부 브라우저로 여는 전용 주소를 지원한다
  if (app.kakao) return `kakaotalk://web/openExternal?url=${encodeURIComponent(href)}`;
  // 안드로이드는 intent 주소로 크롬을 지정해 연다
  if (app.android) {
    const u = new URL(href);
    return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(":", "")};package=com.android.chrome;end`;
  }
  return null;
}
