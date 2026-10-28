import { NextResponse, type NextRequest } from "next/server";
import { drainQueue } from "@/lib/jobs/analyze-notice";

export const maxDuration = 300;

/**
 * 대기 중이거나 실패 후 재시도할 공지 분석 작업을 처리한다.
 * Supabase pg_cron이 1분마다 호출 (Authorization: Bearer CRON_SECRET)
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const results = await drainQueue(240_000);
  return NextResponse.json({ processed: results.length, results });
}
