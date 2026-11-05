import { expect, test } from "@playwright/test";
import { deleteUsersByPrefix, service, signupViaUi } from "./helpers";

// 맨 아래 '의견 남기기': 바로 창이 뜨고, 보낸 의견은 관리자만 본다
const tag = Date.now().toString(36);
const prefix = `e2e12-${tag}`;
const email = (k: string) => `${prefix}-${k}@caialender-test.dev`;

test.afterAll(async () => {
  await deleteUsersByPrefix(prefix); // 의견은 회원 삭제와 함께 지워진다
});

test("학생이 맨 아래 '의견 남기기'로 의견을 보내면, 관리자만 의견 목록에서 보고 확인 표시한다", async ({ browser }) => {
  const stu = await browser.newPage();
  await signupViaUi(stu, { name: "의견학생", studentNo: "2027000123", grade: 1, email: email("s") });
  const adm = await browser.newPage();
  await signupViaUi(adm, { name: "의견관리", studentNo: "2027000124", grade: 3, email: email("a") });
  const { data } = await service().auth.admin.listUsers({ perPage: 1000 });
  const adminId = data.users.find((u) => u.email === email("a"))!.id;
  await service().from("profiles").update({ role: "admin" }).eq("id", adminId);

  await stu.goto("/my");
  await stu.getByRole("button", { name: "의견 남기기" }).click();
  const dialog = stu.getByRole("dialog", { name: "의견 남기기" });
  await expect(dialog.getByText("학생회(관리자)만 볼 수 있어요")).toBeVisible();
  await dialog.getByLabel("의견").fill(`${tag} 시간표에서 토요일이 안 보여요`);
  await dialog.getByRole("button", { name: "보내기" }).click();
  await expect(dialog.getByText("의견을 보냈어요")).toBeVisible();
  await dialog.getByRole("button", { name: "닫기" }).first().click();

  // 다른 학생은 남의 의견을 읽을 수 없다 (DB 권한)
  const other = await browser.newPage();
  await signupViaUi(other, { name: "다른학생", studentNo: "2027000125", grade: 1, email: email("o") });
  await other.goto("/admin/feedback"); // 관리자 화면은 막히고 의견 내용은 보이지 않는다
  await expect(other.getByText(`${tag} 시간표에서`)).toHaveCount(0);
  await expect(other.getByRole("heading", { name: "💬 베타 의견" })).toHaveCount(0);

  await adm.goto("/admin");
  await expect(adm.getByRole("link", { name: /베타 의견 \(새 의견 \d+\)/ })).toBeVisible();
  await adm.goto("/admin/feedback");
  const item = adm.getByTestId("feedback-item").filter({ hasText: tag });
  await expect(item).toContainText("시간표에서 토요일이 안 보여요");
  await expect(item).toContainText("의견학생 · 1학년");
  await expect(item).toContainText("보낸 화면 /my");
  await item.getByRole("button", { name: "✓ 확인함" }).click();
  await expect(item.getByText("확인함", { exact: true })).toBeVisible();
  await stu.close(); await adm.close(); await other.close();
});
