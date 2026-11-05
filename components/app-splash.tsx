import { Hobanu } from "@/components/hobanu";

// 휴대폰에서 앱을 처음 열 때 1초 남짓 보이는 시작 화면 (로고 + C:AI:ender).
// 서버가 그린 HTML에 들어 있어 첫 화면부터 바로 보이고, CSS 애니메이션으로 사라진다(누르는 것은 막지 않음).
// 같은 탭에서 이미 본 적 있으면 head의 스크립트가 처음부터 숨긴다. PC에서는 보이지 않는다.
export const SPLASH_SCRIPT = `try{if(sessionStorage.getItem("app_splash_seen")){var s=document.createElement("style");s.textContent="#app-splash{display:none!important}";document.head.appendChild(s)}else{sessionStorage.setItem("app_splash_seen","1")}}catch(e){}`;

export function AppSplash() {
  return (
    <div id="app-splash" aria-hidden="true">
      <div className="app-splash-inner">
        <span className="grid size-24 place-items-center rounded-[28px] bg-white shadow-[0_12px_32px_-8px_rgb(196_27_34/0.35)] ring-1 ring-black/[0.04]">
          <Hobanu className="size-[4.5rem]" title="" />
        </span>
        <p className="mt-5 text-[28px] font-extrabold tracking-tight text-zinc-900">
          C:<span className="text-[#c41b22]">AI</span>:ender
        </p>
        <p className="mt-1.5 text-[13px] text-zinc-500">경북대학교 인공지능전공 캘린더</p>
      </div>
    </div>
  );
}
