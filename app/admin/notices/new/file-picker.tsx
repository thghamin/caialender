"use client";

import { useRef, useState } from "react";
import { shrinkImage } from "@/lib/client/shrink-image";

const ACCEPT = ["image/png", "image/jpeg", "image/webp"];
const MAX = 6;
// Vercel 서버 요청 4.5MB 제한 안에 들도록 사진은 긴 변 1600px로 줄이고, 합계를 확인한다
const MAX_TOTAL = 4 * 1024 * 1024;

type Picked = { file: File; url: string };

/** 사진 여러 장 첨부: '파일 선택' 버튼(여러 장 고르기) + 끌어다 놓기 + 미리보기·한 장씩 빼기. 실제 전송은 숨긴 input(name="image") */
export function PosterPicker() {
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Picked[]>([]);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  // 고른 파일 목록을 숨긴 input에 그대로 반영한다 (폼 전송용)
  const sync = (list: Picked[]) => {
    const dt = new DataTransfer();
    for (const p of list) dt.items.add(p.file);
    if (input.current) input.current.files = dt.files;
    setItems(list);
    const total = list.reduce((s, p) => s + p.file.size, 0);
    setError(total > MAX_TOTAL ? `사진 용량이 너무 커요(${(total / 1024 / 1024).toFixed(1)}MB). 몇 장 빼 주세요.` : undefined);
  };

  const add = async (files: File[]) => {
    const ok = files.filter((f) => ACCEPT.includes(f.type));
    if (!ok.length) return;
    setBusy(true);
    const small = await Promise.all(ok.map((f) => shrinkImage(f, 1600)));
    setBusy(false);
    const next = [...items, ...small.map((file) => ({ file, url: URL.createObjectURL(file) }))];
    if (next.length > MAX) setError(`사진은 ${MAX}장까지 올릴 수 있어요. 앞의 ${MAX}장만 넣었어요.`);
    for (const p of next.slice(MAX)) URL.revokeObjectURL(p.url);
    sync(next.slice(0, MAX));
  };

  const remove = (i: number) => {
    URL.revokeObjectURL(items[i].url);
    sync(items.filter((_, j) => j !== i));
  };

  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-zinc-700">포스터·첨부 사진 (선택, 최대 {MAX}장, PNG·JPG·WEBP)</span>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          add([...e.dataTransfer.files]);
        }}
        className={`flex flex-col gap-3 rounded-xl border-2 border-dashed p-3 transition-colors ${drag ? "border-brand bg-brand-soft" : "border-zinc-300 bg-zinc-50"}`}
      >
        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-lg bg-zinc-800 px-4 py-2 font-semibold text-white shadow-sm hover:bg-zinc-900">
            📎 파일 선택
            <input
              ref={input}
              name="image"
              type="file"
              multiple
              accept={ACCEPT.join(",")}
              aria-label="포스터 이미지 파일"
              className="sr-only"
              onChange={async (e) => {
                const files = [...(e.target.files ?? [])];
                // input의 파일 목록은 sync가 다시 채우므로, 먼저 지금 고른 것만 받아 둔다
                await add(files.filter((f) => !items.some((p) => p.file === f)));
              }}
            />
          </label>
          <span className="text-zinc-500">
            {busy ? "사진을 줄이는 중…" : items.length ? `${items.length}장 첨부됨 · 더 고르면 추가돼요` : "여러 장을 한꺼번에 고르거나 여기로 끌어다 놓으세요"}
          </span>
        </div>
        {items.length > 0 && (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="첨부한 사진">
            {items.map((p, i) => (
              <li key={p.url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- 로컬 미리보기(blob URL) */}
                <img src={p.url} alt={`첨부 사진 ${i + 1}`} className="aspect-square w-full rounded-lg object-cover ring-1 ring-zinc-200" />
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label={`첨부 사진 ${i + 1} 빼기`}
                  className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-zinc-900 text-xs text-white shadow"
                >
                  ✕
                </button>
                <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[0.625rem] text-white">{i + 1}</span>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="text-red-600">{error}</p>}
      </div>
    </div>
  );
}
