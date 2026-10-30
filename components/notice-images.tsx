import { createClient } from "@/lib/supabase/server";

/** 공지 첨부 사진들 (비공개 버킷이라 서버에서 잠깐 쓰는 서명 주소를 만든다) */
export async function NoticeImages({ paths, expiresIn = 3600 }: { paths: string[]; expiresIn?: number }) {
  if (!paths.length) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from("posters").createSignedUrls(paths, expiresIn);
  const urls = (data ?? []).map((d) => d.signedUrl).filter(Boolean) as string[];
  return (
    <div className={`grid gap-2 ${urls.length > 1 ? "sm:grid-cols-2" : ""}`}>
      {urls.map((u, i) => (
        <a key={u} href={u} target="_blank" rel="noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element -- 서명 주소(만료됨)라 이미지 최적화를 쓰지 않는다 */}
          <img src={u} alt={urls.length > 1 ? `공지 사진 ${i + 1}` : "공지 포스터"} className="max-h-[700px] w-full rounded-md border object-contain" />
        </a>
      ))}
    </div>
  );
}
