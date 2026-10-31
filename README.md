# C:AI:ender (캘린더)

**학과 공지 속 일정을 AI가 캘린더로.** 경북대학교 전자공학부 인공지능전공 학생을 위한 학과 캘린더 서비스입니다.
학생회가 올린 공지(글·포스터 사진)에서 AI가 일정을 뽑고, 학생회가 검수해 게시하면 학생은 필요한 일정만 내 캘린더에 담아 알림을 받습니다.

- 서비스: https://caialender.vercel.app (가입 후 학생회 승인 필요 · 베타 운영 중)
- 팀: ALGOALITHM — AI:CRAFT 해커톤 for 27

## 주요 기능

**캘린더**
- 학과 캘린더(학생회 일정) · 학사 캘린더(경북대 공식 학사일정) · 내 캘린더(☆로 담은 일정 + 개인 일정)
- 일정 담기, 하루 전·1시간 전 알림, 개인 일정 시간 겹침 경고, 내 테마 색 바꾸기

**AI 기능**
- 공지 글·포스터 사진(최대 6장) → 일정·마감·장소·대상 자동 추출, 공지 제목 생성
- 일정마다 공지 원문의 근거 문장 표시, 공지 변경 감지, 누락 정보 알림, AI 주간 브리핑
- 에브리타임 시간표 캡처 → 내 시간표 (시간은 이미지 픽셀로 직접 측정, 글자만 비전 AI가 읽는 하이브리드 방식)
- AI 결과는 학생회가 검수·수정한 뒤 게시하며, AI 장애 시에도 저장된 캘린더는 정상 동작

**학년별 소통방**
- 1~4학년 방에서 닉네임으로 수업 정보·휴강·시험 범위 공유 (학생끼리는 닉네임만, 관리자만 실명 확인)
- 답장, 신고 → 관리자 알림, 경고(사유 알림) 3회 누적 시 입장 제한, 방별 알림 켜고 끄기, '학생회' 공식 공지

**그 밖에**
- 내 시간표(수업 10분 전 알림), 질문 게시판(학생회 답변 + 알림), 통합 검색
- 공식당(공학관 학생식당) 주간 메뉴 — 생협 홈페이지를 자동으로 읽어 요일별 표시
- 가입 승인제(학과 학생만), 총관리자 → 학생회 관리자 임명
- 휴대폰 앱처럼 설치(PWA)·웹 푸시 알림, 처음 사용자를 위한 사용법 안내, 앱 속 브라우저(카카오톡·인스타그램 등) → Safari/크롬 이동 안내

## 기술 구성
- **웹**: Next.js 16 (App Router) + React 19 + Tailwind CSS v4, Vercel(서울 icn1)
- **데이터**: Supabase — Postgres, Auth(이메일), Storage(포스터), 행 단위 권한(RLS), pg_cron(1분마다 분석 재시도·알림 발송)
- **AI**: OpenRouter의 Qwen 오픈웨이트 모델 — `qwen3.6-35b-a3b`(텍스트), `qwen3-vl-235b`(이미지). OpenAI 호환 API라 로컬 Ollama로도 교체 가능
- **알림**: Web Push(VAPID) + 서비스 워커

## 개발
```bash
npm install
cp .env.local.example .env.local   # 값 채우기 (비밀키는 저장소에 올리지 않음)
npm run db:push                    # supabase/migrations 적용
npm run dev
npm run import-academic -- 2026     # 경북대 학사일정 불러오기 (관리자 화면 버튼으로도 가능)
npm run make-admin -- 이메일 [admin|super_admin|student]
```

## 테스트
```bash
npm test                 # 단위 테스트 (일정 추출 규칙, 시간표 픽셀 측정, 알림 시각, 소통방 규칙, 식단 읽기 등)
npm run test:rls         # 실제 DB에서 권한(RLS) 검증 — 테스트 전용 계정을 만들고 끝나면 삭제
npx next dev -p 3100 &   # E2E 대상 서버
npm run test:e2e         # 브라우저 E2E (휴대폰·PC 화면, 실제 AI 호출 포함)
AI_EVAL=1 node --env-file=.env.local node_modules/.bin/vitest run tests/ai-*.eval.test.ts --silent=false  # AI 품질 평가
```

## 배포
```bash
npx vercel deploy --prod
npm run setup-cron -- https://배포주소   # 1분마다 분석 재시도·알림 발송
```

## 생성형 AI 활용
기획은 ChatGPT, 설계·구현·테스트·배포는 AI 코딩 에이전트(Claude Code)와 함께 진행했습니다.
사람은 문제 정의·판단·검증을 맡고, AI 결과는 실제 데이터와 자동 테스트로 확인한 뒤 반영했습니다.
