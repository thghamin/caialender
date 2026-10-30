import type { MetadataRoute } from "next";

/** 휴대폰 홈 화면에 앱처럼 설치 (아이폰은 설치해야 알림을 받을 수 있다) */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "C:AI:ender — 인공지능전공 캘린더",
    short_name: "C:AI:ender",
    description: "학과 공지를 AI로 정리한 학과·학사·내 캘린더와 시간표",
    start_url: "/my",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#c41b22",
    lang: "ko",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
