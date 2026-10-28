import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Card } from "@/components/ui";
import { SignupForm } from "./signup-form";

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/my");

  return (
    <div className="max-w-sm mx-auto mt-10">
      <Card>
        <h1 className="text-xl font-bold mb-1">회원가입</h1>
        <p className="text-sm text-zinc-500 mb-5">학년 정보로 나에게 해당하는 일정을 모아 드립니다.</p>
        <SignupForm />
      </Card>
    </div>
  );
}
