# C:AI:ender (캘린더)

경북대 인공지능전공 학과 공지(텍스트·포스터)에서 AI가 일정을 추출하면, 학생회 기획부가 검수해 게시하는 학과 공용 캘린더입니다.

## 기능
- 전체 캘린더 / 내 캘린더(내 학년 + 전체 대상 + 관심 일정 + 개인 일정)
- 일정 상세, D-day, 개인 일정 시간 충돌 경고
- 기획부 관리자: 공지 등록(텍스트·포스터) → 백그라운드 AI 분석 → 검수·수정 → 게시
- AI: 일정 추출(행사·마감 분리), 누락 정보 표시, 기존 일정 변경 감지, 주간 브리핑
- AI 장애 시에도 캘린더·공지 조회와 일정 직접 등록은 정상 동작

## 구성
- Next.js 16 (App Router) + Vercel (함수 지역: 서울 icn1)
- Supabase: Postgres, Auth(이메일), Storage(포스터), RLS, pg_cron(분석 재시도)
- AI: OpenRouter의 Qwen 오픈웨이트 모델 (`qwen/qwen3.6-35b-a3b`, 대체 `qwen3-vl-235b`). OpenAI 호환 API라서 로컬 Ollama로도 바꿀 수 있음

## 개발
```bash
npm install
cp .env.local.example .env.local   # 값 채우기
npm run db:push                    # supabase/migrations 적용
npm run dev
npm run import-academic -- 2026     # 경북대 학사일정 불러오기 (관리자 화면 버튼으로도 가능)
npm run make-admin -- 이메일 [admin|super_admin|student]  # 역할 지정 (평소에는 총관리자가 웹의 회원 관리에서 임명)
```

## 테스트
```bash
npm test                 # 단위 테스트
npm run test:rls         # 실제 DB에서 RLS 권한 검증 (테스트 계정 생성 후 삭제)
npx next dev -p 3100 &   # E2E 대상 서버
npm run test:e2e         # 브라우저 E2E (실제 AI 호출)
AI_EVAL=1 node --env-file=.env.local node_modules/.bin/vitest run tests/ai-*.eval.test.ts --silent=false  # AI 품질 평가
```

## 배포
```bash
npx vercel deploy --prod
npm run setup-cron -- https://배포주소   # 1분마다 분석 재시도
```
