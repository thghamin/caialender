import { expect, test, type Page } from "@playwright/test";
import { deleteUsersByPrefix, loginViaUi, service, signupViaUi } from "./helpers";

// 학년별 소통방: 닉네임만 보이고(관리자만 실명), 관리자 삭제·경고, 경고 3회면 글쓰기 제한
const tag = Date.now().toString(36);
const prefix = `e2e10-${tag}`;
const email = (k: string) => `${prefix}-${k}@caialender-test.dev`;
const ids: Record<string, string> = {};
const nick = (k: string) => `${k}${tag}`.slice(0, 12);

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  for (const [k, name] of [["a", "소통가학생"], ["b", "소통나학생"], ["admin", "소통관리자"]] as const) {
    const page = await browser.newPage();
    await signupViaUi(page, { name, studentNo: "2027000000", grade: 2, email: email(k) });
    await page.close();
  }
  const { data } = await service().auth.admin.listUsers({ perPage: 1000 });
  for (const u of data.users.filter((u) => u.email?.startsWith(prefix))) ids[u.email!.slice(prefix.length + 1).split("@")[0]] = u.id;
  await service().from("profiles").update({ role: "admin" }).eq("id", ids.admin);
});

test.afterAll(async () => deleteUsersByPrefix(prefix)); // 닉네임·메시지·경고는 회원 삭제와 함께 지워진다

async function enter(page: Page, k: string, room: number) {
  await loginViaUi(page, email(k));
  await page.waitForURL("**/my");
  await page.goto(`/chat/${room}`);
  const form = page.getByLabel("닉네임");
  if (await form.isVisible().catch(() => false)) {
    await form.fill(nick(k));
    await page.getByRole("button", { name: "정하기" }).click();
  }
  await expect(page.getByLabel("메시지")).toBeVisible();
}

async function send(page: Page, text: string) {
  await page.getByLabel("메시지").fill(text);
  await page.getByRole("button", { name: "보내기" }).click();
  await expect(page.getByTestId("chat-message").filter({ hasText: text })).toBeVisible();
}

test("소통방: 학년 방을 골라 닉네임으로 대화하고, 학생에게는 닉네임만 보인다", async ({ browser }) => {
  const a = await browser.newPage();
  await enter(a, "a", 2);
  await send(a, `${tag} 자료구조 과제 몇 장까지예요?`);

  const b = await browser.newPage();
  await loginViaUi(b, email("b"));
  await b.waitForURL("**/my");
  await b.goto("/chat");
  // 방 목록에 최근 메시지가 보이고, 골라서 들어간다
  await expect(b.getByRole("link", { name: /2학년 소통방/ })).toContainText(nick("a"));
  await b.getByRole("link", { name: /2학년 소통방/ }).click();
  await b.getByLabel("닉네임").fill(nick("b"));
  await b.getByRole("button", { name: "정하기" }).click();
  const msg = b.getByTestId("chat-message").filter({ hasText: `${tag} 자료구조` });
  await expect(msg).toContainText(nick("a"));
  // 실명·학번은 보이지 않는다
  await expect(b.getByText("소통가학생")).toHaveCount(0);
  await expect(b.getByTestId("chat-identity")).toHaveCount(0);
  await send(b, `${tag} 3장까지요`);
  // 상대 메시지는 몇 초 안에 자동으로 뜬다
  await expect(a.getByTestId("chat-message").filter({ hasText: `${tag} 3장까지요` })).toBeVisible({ timeout: 10_000 });
  // 다른 학년 방은 따로다
  await b.goto("/chat/3");
  await expect(b.getByText(`${tag} 자료구조`)).toHaveCount(0);
  await a.close();
  await b.close();
});

test("관리자: 닉네임의 실제 회원을 보고, 삭제·경고한다. 경고 3회면 글을 쓸 수 없다", async ({ browser }) => {
  const admin = await browser.newPage();
  await enter(admin, "admin", 2);
  const target = admin.getByTestId("chat-message").filter({ hasText: `${tag} 자료구조` });
  await expect(target.getByTestId("chat-identity")).toContainText("소통가학생");

  // 경고 1 (메시지 삭제됨)
  await target.getByRole("button", { name: "경고" }).click();
  const dialog = admin.getByRole("dialog", { name: "경고 주기" });
  await dialog.getByRole("button", { name: "도배" }).click();
  await dialog.getByRole("button", { name: "경고하고 삭제" }).click();
  await expect(dialog).toBeHidden();
  await expect(admin.getByText("관리자가 삭제한 메시지예요").first()).toBeVisible();

  // 학생 화면: 경고 횟수·사유
  const a = await browser.newPage();
  await enter(a, "a", 2);
  await expect(a.getByText(/받은 경고 1\/3/)).toBeVisible();
  await a.goto("/chat");
  await expect(a.getByText("도배").first()).toBeVisible();

  // 경고 2, 3 → 글쓰기 제한
  for (let i = 2; i <= 3; i++) {
    await a.goto("/chat/2");
    await send(a, `${tag} 경고${i}`);
    await admin.reload();
    await admin.getByTestId("chat-message").filter({ hasText: `${tag} 경고${i}` }).getByRole("button", { name: "경고" }).click();
    await admin.getByRole("dialog", { name: "경고 주기" }).getByRole("button", { name: "경고하고 삭제" }).click();
    await expect(admin.getByRole("dialog", { name: "경고 주기" })).toBeHidden();
  }
  await a.goto("/chat/2");
  await expect(a.getByText(/경고 3회로 소통방에 글을 쓸 수 없어요/)).toBeVisible();
  await expect(a.getByLabel("메시지")).toHaveCount(0);

  // 관리자가 단순 삭제도 할 수 있다
  const b = await browser.newPage();
  await enter(b, "b", 2);
  await send(b, `${tag} 지울 메시지`);
  await admin.reload();
  admin.once("dialog", (d) => d.accept());
  await admin.getByTestId("chat-message").filter({ hasText: `${tag} 지울 메시지` }).getByRole("button", { name: "삭제" }).click();
  await expect(admin.getByTestId("chat-message").filter({ hasText: `${tag} 지울 메시지` })).toHaveCount(0);
  await Promise.all([admin.close(), a.close(), b.close()]);
});
