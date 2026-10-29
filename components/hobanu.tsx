// 경북대 상징동물 호반우(虎班牛, 칡소)를 본뜬 캐릭터. 갈색 몸에 호랑이 무늬, 경북대 빨강 스카프.
// 학교 공식 캐릭터 이미지가 아니라 이 서비스에서 직접 그린 SVG다.
export function Hobanu({ className = "", title = "호반우" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label={title}>
      <title>{title}</title>
      {/* 뿔 */}
      <path d="M66 52 C52 46 40 32 42 14 C50 26 62 34 78 40 Z" fill="#F3E3C3" stroke="#C9B48F" strokeWidth="2" />
      <path d="M134 52 C148 46 160 32 158 14 C150 26 138 34 122 40 Z" fill="#F3E3C3" stroke="#C9B48F" strokeWidth="2" />
      {/* 귀 */}
      <ellipse cx="36" cy="80" rx="24" ry="13" transform="rotate(-24 36 80)" fill="#9A5B2A" />
      <ellipse cx="38" cy="80" rx="14" ry="6.5" transform="rotate(-24 38 80)" fill="#F4B8A8" />
      <ellipse cx="164" cy="80" rx="24" ry="13" transform="rotate(24 164 80)" fill="#9A5B2A" />
      <ellipse cx="162" cy="80" rx="14" ry="6.5" transform="rotate(24 162 80)" fill="#F4B8A8" />
      {/* 스카프 */}
      <path d="M48 138 Q100 168 152 138 L154 158 Q100 186 46 158 Z" fill="#DA2128" />
      <path d="M112 164 L132 194 L116 190 L106 168 Z" fill="#B3161D" />
      {/* 얼굴 */}
      <ellipse cx="100" cy="98" rx="62" ry="58" fill="#A8672F" />
      {/* 호랑이(칡) 무늬 */}
      <g stroke="#4A2C17" strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.85">
        <path d="M86 44 q5 12 -1 24" />
        <path d="M100 41 q3 14 0 28" />
        <path d="M114 44 q-5 12 1 24" />
        <path d="M42 98 q10 0 15 8" />
        <path d="M45 120 q8 -1 12 5" />
        <path d="M158 98 q-10 0 -15 8" />
        <path d="M155 120 q-8 -1 -12 5" />
      </g>
      {/* 앞머리 */}
      <path d="M82 46 Q90 30 100 40 Q110 28 118 46 Q100 54 82 46 Z" fill="#7A4520" />
      {/* 눈 */}
      <circle cx="74" cy="94" r="9" fill="#2B1B10" />
      <circle cx="126" cy="94" r="9" fill="#2B1B10" />
      <circle cx="77" cy="90.5" r="3" fill="#fff" />
      <circle cx="129" cy="90.5" r="3" fill="#fff" />
      {/* 볼 */}
      <ellipse cx="58" cy="116" rx="9" ry="5.5" fill="#F07A6A" opacity="0.55" />
      <ellipse cx="142" cy="116" rx="9" ry="5.5" fill="#F07A6A" opacity="0.55" />
      {/* 주둥이 */}
      <ellipse cx="100" cy="130" rx="38" ry="25" fill="#F2D9B8" />
      <ellipse cx="87" cy="127" rx="4.5" ry="6.5" fill="#6B4423" />
      <ellipse cx="113" cy="127" rx="4.5" ry="6.5" fill="#6B4423" />
      <path d="M90 142 Q100 150 110 142" stroke="#6B4423" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}
