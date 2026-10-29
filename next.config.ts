import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    // 한 번 연 페이지는 30초 동안 브라우저에 보관해서 탭을 오갈 때 바로 보인다.
    // 내가 데이터를 바꾸면(서버 액션의 revalidatePath) 즉시 새로 불러온다.
    staleTimes: { dynamic: 30 },
    serverActions: {
      // 포스터 이미지 업로드
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
