"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** AI 분석이 끝날 때까지 주기적으로 화면을 새로고침 */
export function AutoRefresh({ intervalMs = 3000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(t);
  }, [router, intervalMs]);
  return null;
}
