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
        <p className="text-sm text-zinc-500 mb-5">가입 후 학생회 관리자가 승인하면 서비스를 이용할 수 있어요.</p>
        <SignupForm />
      </Card>
    </div>
  );
}
