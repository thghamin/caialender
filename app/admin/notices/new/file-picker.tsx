"use client";

import { useRef, useState } from "react";
import { shrinkImage } from "@/lib/client/shrink-image";

const ACCEPT = ["image/png", "image/jpeg", "image/webp"];

/** 포스터 첨부: 눈에 보이는 '파일 선택' 버튼 + 끌어다 놓기 + 미리보기. 실제 전송은 숨긴 input(name="image")이 한다 */
export function PosterPicker() {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; size: number; url: string } | null>(null);
  const [drag, setDrag] = useState(false);

  const show = (f: File | undefined) => {
    if (file) URL.revokeObjectURL(file.url);
    setFile(f ? { name: f.name, size: f.size, url: URL.createObjectURL(f) } : null);
  };
  const clear = () => {
    if (input.current) input.current.value = "";
    show(undefined);
  };

  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-zinc-700">포스터·첨부 이미지 (선택, PNG·JPG·WEBP, 8MB 이하)</span>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files[0];
          if (!f || !ACCEPT.includes(f.type) || !input.current) return;
          const el = input.current;
          shrinkImage(f).then((small) => {
            const dt = new DataTransfer();
            dt.items.add(small);
            el.files = dt.files;
            show(small);
          });
        }}
        className={`flex flex-wrap items-center gap-3 rounded-xl border-2 border-dashed p-3 transition-colors ${
          drag ? "border-brand bg-brand-soft" : "border-zinc-300 bg-zinc-50"
        }`}
      >
        <label className="cursor-pointer rounded-lg bg-zinc-800 px-4 py-2 font-semibold text-white shadow-sm hover:bg-zinc-900">
          📎 파일 선택
          <input
            ref={input}
            name="image"
            type="file"
            accept={ACCEPT.join(",")}
            aria-label="포스터 이미지 파일"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              const small = f ? await shrinkImage(f) : undefined;
              if (small && small !== f && input.current) {
                // 큰 사진은 줄인 파일로 바꿔서 올린다 (서버 요청 4.5MB 제한)
                const dt = new DataTransfer();
                dt.items.add(small);
                input.current.files = dt.files;
              }
              show(small);
            }}
          />
        </label>
        {file ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- 로컬 미리보기(blob URL) */}
            <img src={file.url} alt="첨부 미리보기" className="h-16 w-16 rounded-md object-cover ring-1 ring-zinc-200" />
            <div>
              <p className="max-w-56 truncate font-medium">{file.name}</p>
              <p className="text-xs text-zinc-500">{(file.size / 1024 / 1024).toFixed(1)}MB</p>
            </div>
            <button type="button" onClick={clear} className="rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-200">
              ✕ 빼기
            </button>
          </div>
        ) : (
          <span className="text-zinc-500">또는 이미지를 여기로 끌어다 놓으세요</span>
        )}
      </div>
    </div>
  );
}
