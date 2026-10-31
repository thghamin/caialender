import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHero } from "@/components/page-hero";
import { PushSetup } from "@/components/push-setup";
import { Card } from "@/components/ui";
import type { TimetableCourse } from "@/lib/timetable";
import { TimetableClient } from "./timetable-client";

export const metadata: Metadata = { title: "내 시간표 — C:AI:ender" };

export default async function TimetablePage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("timetable_courses")
    .select("id, name, professor, color, reminder, slots:timetable_slots(id, day, start_min, end_min, location)")
    .eq("user_id", user.id)
    .order("created_at");
  if (error) throw new Error(`시간표를 불러오지 못했습니다: ${error.message}`);
  const courses = (data as unknown as (TimetableCourse & { id: string })[]).map((c) => ({
    ...c,
    key: c.id,
    slots: [...c.slots].sort((a, b) => a.day - b.day || a.start_min - b.start_min),
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHero
        tone="timetable"
        badge={user.grade ? `${user.grade}학년 ${user.name}` : user.name}
        title="내 시간표"
        subtitle="수업을 직접 넣거나, 에브리타임 시간표를 캡처해서 올리면 AI가 그대로 옮겨 줘요. 수업마다 10분 전 알림을 켤 수 있어요."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* min-w-0: 긴 수업 목록이 화면 폭을 넘겨 늘어나지 않게 */}
        <section className="min-w-0">
          <TimetableClient initial={courses} />
        </section>
        <aside className="flex min-w-0 flex-col gap-4">
          <Card>
            <PushSetup />
          </Card>
        </aside>
      </div>
    </div>
  );
}
