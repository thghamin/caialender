// 카카오톡·인스타그램·네이버 앱 등 '앱 안의 브라우저' 감지.
// 이런 브라우저에서는 홈 화면에 추가(앱 설치)와 알림이 되지 않아 Safari/크롬으로 열어야 한다.
export type InApp = { name: string; kakao: boolean; line: boolean; ios: boolean; android: boolean; steps: string[] } | null;

// 앱별로 '바깥 브라우저로 열기' 메뉴가 있는 곳 (아이폰은 자동으로 못 옮기므로 이 순서대로 안내)
const IOS_GENERIC = ["화면 오른쪽 위(또는 아래)의 ··· 메뉴나 공유 버튼을 눌러요", "'Safari로 열기' 또는 '외부 브라우저로 열기'를 눌러요"];
const APPS: [RegExp, string, string[]][] = [
  [/KAKAOTALK/i, "카카오톡", ["오른쪽 아래 ··· 버튼을 눌러요", "'다른 브라우저로 열기'를 눌러요"]],
  [/KAKAOSTORY/i, "카카오스토리", IOS_GENERIC],
  [/\bLine\//i, "라인", ["오른쪽 위 ··· 버튼을 눌러요", "'Safari로 열기'를 눌러요"]],
  [/NAVER\(inapp|NAVER\//i, "네이버 앱", ["오른쪽 아래 ··· 버튼을 눌러요", "'Safari로 열기'(또는 '다른 브라우저로 열기')를 눌러요"]],
  [/Instagram/i, "인스타그램", ["오른쪽 위 ··· 버튼을 눌러요", "'외부 브라우저에서 열기'를 눌러요"]],
  [/Barcelona/i, "스레드", ["오른쪽 위 ··· 버튼을 눌러요", "'브라우저에서 열기'를 눌러요"]],
  [/FBAN|FBAV|FB_IAB|FBIOS/i, "페이스북", ["오른쪽 위(또는 아래) ··· 버튼을 눌러요", "'Safari에서 열기' 또는 '외부 브라우저로 열기'를 눌러요"]],
  [/DaumApps/i, "다음 앱", IOS_GENERIC],
  [/everytimeApp/i, "에브리타임", IOS_GENERIC],
  [/BAND\//i, "밴드", ["오른쪽 위 ··· 버튼을 눌러요", "'기본 브라우저로 열기'를 눌러요"]],
  [/musical_ly|BytedanceWebview|TikTok/i, "틱톡", IOS_GENERIC],
  [/Snapchat/i, "스냅챗", IOS_GENERIC],
  [/Twitter/i, "X(트위터)", IOS_GENERIC],
];

export function detectInApp(ua: string): InApp {
  const ios = /iphone|ipad|ipod/i.test(ua);
  const android = /android/i.test(ua);
  const hit = APPS.find(([re]) => re.test(ua));
  if (hit) return { name: hit[1], kakao: hit[1] === "카카오톡", line: hit[1] === "라인", ios, android, steps: hit[2] };
  // 목록에 없는 앱: 안드로이드 웹뷰는 '; wv)', 아이폰 앱 속 화면은 'Safari/' 표시가 없다
  // (아이폰 크롬·파이어폭스·엣지는 각자 표시가 있고, 홈 화면에 추가한 앱은 화면 쪽에서 따로 걸러낸다)
  if (android && /; wv\)/.test(ua)) return { name: "앱 속 브라우저", kakao: false, line: false, ios, android, steps: IOS_GENERIC };
  if (ios && /AppleWebKit/.test(ua) && !/Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua))
    return { name: "앱 속 브라우저", kakao: false, line: false, ios, android, steps: IOS_GENERIC };
  return null;
}

/** 지금 주소를 바깥 브라우저(Safari/크롬)로 바로 여는 주소. 없으면 null (아이폰의 다른 앱 → 안내) */
export function externalOpenUrl(app: NonNullable<InApp>, href: string): string | null {
  // 카카오톡은 iOS·안드로이드 모두 외부 브라우저로 여는 전용 주소를 지원한다
  if (app.kakao) return `kakaotalk://web/openExternal?url=${encodeURIComponent(href)}`;
  // 라인은 주소에 openExternalBrowser=1을 붙이면 바깥 브라우저로 연다
  if (app.line) {
    const u = new URL(href);
    u.searchParams.set("openExternalBrowser", "1");
    return u.toString();
  }
  // 안드로이드는 intent 주소로 크롬을 지정해 연다 (대부분의 앱 속 브라우저에서 동작)
  if (app.android) {
    const u = new URL(href);
    return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(":", "")};package=com.android.chrome;end`;
  }
  return null;
}
