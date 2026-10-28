import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Alert, Card } from "@/components/ui";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getCurrentUser()) redirect("/my");
  const { next, error } = await searchParams;

  return (
    <div className="max-w-sm mx-auto mt-10">
      <Card>
        <h1 className="text-xl font-bold mb-5">로그인</h1>
        {error === "confirm" && (
          <div className="mb-4">
            <Alert kind="error">메일 인증 링크가 만료되었거나 올바르지 않습니다.</Alert>
          </div>
        )}
        <LoginForm next={typeof next === "string" ? next : undefined} />
      </Card>
    </div>
  );
}
