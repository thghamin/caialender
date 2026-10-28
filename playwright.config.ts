import { defineConfig } from "@playwright/test";

// 실행: 개발 서버(npx next dev -p 3100)를 띄운 뒤
//   node --env-file=.env.local node_modules/.bin/playwright test
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  workers: 1,
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100", locale: "ko-KR", timezoneId: "Asia/Seoul" },
  reporter: [["list"]],
});
