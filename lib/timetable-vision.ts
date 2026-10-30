// 에브리타임 시간표 스크린샷에서 수업 칸의 '위치'를 픽셀로 직접 재서 정확한 시각을 구한다 (순수 함수, 테스트 대상)
// AI는 글자(과목명·교수명·강의실)와 요일을 읽고, 시각은 여기서 잰 칸의 위·아래 끝으로 정한다.
// 1) 시간 눈금 가로선·요일 세로선을 찾는다. 수업 칸이 선을 가리므로, 보이는 선들의 '일정한 간격'으로 나머지를 복원한다.
// 2) 요일 칸마다 세로로 훑어 흰 바탕이 아닌 구간(수업 칸)을 찾는다. 색이 바뀌면 다른 칸으로 나눈다.
// 3) 칸의 위·아래 끝을 시각으로 바꾸고 30분 단위로 맞춘다 (모든 수업은 30분 단위로 시작·끝난다).

export type RawImage = { data: Uint8Array | Buffer; width: number; height: number; channels: number };
/** truncated: 칸 아래가 시간표 상자 끝(스크롤)에서 잘려 끝 시각을 알 수 없음 */
export type DetectedBlock = { day: number; start_min: number; end_min: number; top: number; bottom: number; color: [number, number, number]; truncated: boolean };
export type GridInfo = { lineY: number[]; colX: number[]; hourPx: number };

type RGB = [number, number, number];

function pixel(img: RawImage, x: number, y: number): RGB {
  const i = (y * img.width + x) * img.channels;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
}
const isGridGray = ([r, g, b]: RGB) => {
  const mx = Math.max(r, g, b);
  return mx - Math.min(r, g, b) < 14 && mx > 195 && mx < 246;
};
const isWhite = ([r, g, b]: RGB) => r > 246 && g > 246 && b > 246;
const dist = (a: RGB, b: RGB) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

/** 후보 좌표들에서 일정 간격(등차수열)을 찾아 가려진 선까지 복원한다 */
export function fitProgression(cands: number[], minGap: number, maxGap: number, limit: number) {
  // 붙어 있는 좌표는 하나로
  const pts: number[] = [];
  for (const c of [...cands].sort((a, b) => a - b)) if (!pts.length || c - pts[pts.length - 1] > 2) pts.push(c);
  let best = { start: 0, gap: 0, score: 0 };
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      for (let k = 1; k <= 6; k++) {
        const gap = (pts[j] - pts[i]) / k;
        if (gap < minGap || gap > maxGap) continue;
        // 이 간격으로 몇 개의 후보가 맞아떨어지는지
        const tol = Math.max(1.5, gap * 0.06);
        const score = pts.filter((p) => {
          const n = (p - pts[i]) / gap;
          return Math.abs(n - Math.round(n)) * gap <= tol;
        }).length;
        if (score > best.score || (score === best.score && gap > best.gap)) best = { start: pts[i], gap, score };
      }
    }
  }
  if (best.score < 3) return null;
  const lines: number[] = [];
  const tol = Math.max(1.5, best.gap * 0.06);
  // 앞뒤로 늘리되, 실제 선이 하나도 없는 바깥쪽은 잘라낸다
  const matched = pts.filter((p) => {
    const n = (p - best.start) / best.gap;
    return Math.abs(n - Math.round(n)) * best.gap <= tol;
  });
  // 맞은 선들로 시작점·간격을 최소제곱으로 다시 맞춘다 (화면 축소로 간격이 소수점이라 누적 오차가 생긴다)
  const idx = matched.map((p) => Math.round((p - best.start) / best.gap));
  const n = matched.length;
  const mi = idx.reduce((a, b) => a + b, 0) / n;
  const mp = matched.reduce((a, b) => a + b, 0) / n;
  const cov = idx.reduce((sum, k, t) => sum + (k - mi) * (matched[t] - mp), 0);
  const varI = idx.reduce((sum, k) => sum + (k - mi) ** 2, 0);
  const gap = varI > 0 ? cov / varI : best.gap;
  const start = mp - gap * mi;
  const kMin = Math.min(...idx);
  const kMax = Math.max(...idx);
  for (let k = kMin; k <= kMax; k++) {
    const v = start + gap * k;
    if (v >= 0 && v < limit) lines.push(Math.round(v));
  }
  return { lines, gap };
}

/** 시간 눈금 가로선과 요일 세로선 */
export function detectGrid(img: RawImage): GridInfo | null {
  const { width: W, height: H } = img;
  const rowCands: number[] = [];
  for (let y = 0; y < H; y++) {
    let g = 0;
    for (let x = 0; x < W; x++) if (isGridGray(pixel(img, x, y))) g++;
    // 수업 칸이 선의 일부를 가리므로 폭의 25%만 보여도 후보
    if (g > W * 0.25 && g < W * 0.995) rowCands.push(y);
  }
  const rows = fitProgression(rowCands, W * 0.06, W * 0.22, H);
  if (!rows || rows.lines.length < 3) return null;
  const top = rows.lines[0];
  const bottom = rows.lines[rows.lines.length - 1];

  const colCands: number[] = [];
  for (let x = 0; x < W; x++) {
    let g = 0;
    for (let y = top; y <= bottom; y++) if (isGridGray(pixel(img, x, y))) g++;
    if (g > (bottom - top) * 0.25) colCands.push(x);
  }
  const cols = fitProgression(colCands, W * 0.1, W * 0.25, W);
  if (!cols) return null;
  // 왼쪽 끝 시간 숫자 칸까지 늘린다 (요일 칸 간격으로 왼쪽에 더 들어갈 자리가 있으면 추가)
  const colX = [...cols.lines];
  while (colX[0] - cols.gap > W * 0.02) colX.unshift(Math.round(colX[0] - cols.gap));
  while (colX[colX.length - 1] + cols.gap < W - 1) colX.push(Math.round(colX[colX.length - 1] + cols.gap));
  if (W - colX[colX.length - 1] > cols.gap * 0.6) colX.push(W - 1);
  return { lineY: rows.lines, colX, hourPx: rows.gap };
}

const snap30 = (m: number) => Math.round(m / 30) * 30;

/**
 * 요일 칸마다 수업 칸(흰 바탕이 아닌 구간)을 찾아 시각으로 바꾼다.
 * startHour: 맨 위 가로선의 시각(에타 왼쪽 첫 숫자, 보통 9)
 */
export function detectBlocks(img: RawImage, grid: GridInfo, startHour: number): DetectedBlock[] {
  const { lineY, colX, hourPx } = grid;
  const top = lineY[0];
  const bottom = lineY[lineY.length - 1];
  const onLine = (y: number) => lineY.some((l) => Math.abs(l - y) <= 1);
  const blocks: DetectedBlock[] = [];


  for (let day = 0; day < colX.length - 1; day++) {
    const xl = colX[day];
    const xr = colX[day + 1];
    // 글자는 왼쪽 정렬이라 칸 오른쪽 가장자리 근처를 여러 줄로 훑는다
    const xs = [0.78, 0.86, 0.93].map((f) => Math.round(xl + (xr - xl) * f));
    // 칸 바탕색만 따라간다. 글자(어두운 픽셀)는 같은 칸으로 보고, 바탕색이 몇 줄 연속으로 바뀌어야 다른 칸으로 나눈다
    let cur: { top: number; color: RGB; samples: RGB[]; changeAt: number | null; newColor: RGB | null } | null = null;
    const close = (y: number) => {
      if (!cur) return;
      const h = y - cur.top;
      if (h >= hourPx * 0.35) {
        const n = cur.samples.length || 1;
        const color: RGB = [0, 1, 2].map((c) => Math.round(cur!.samples.reduce((sum, p) => sum + p[c], 0) / n)) as RGB;
        const start = snap30(startHour * 60 + ((cur.top - top) / hourPx) * 60);
        const end = snap30(startHour * 60 + ((y - top) / hourPx) * 60);
        if (end > start) blocks.push({ day, start_min: start, end_min: end, top: cur.top, bottom: y, color, truncated: false });
      }
      cur = null;
    };
    const SPLIT_ROWS = Math.max(3, Math.round(hourPx * 0.12));
    for (let y = top; y <= bottom; y++) {
      // 칸 안을 지나는 시간 눈금선은 같은 칸으로 본다 (옅은 칸 색이 회색 눈금과 비슷하다)
      if (cur && onLine(y)) continue;
      const ps = xs.map((x) => pixel(img, x, y));
      const whites = ps.filter((p) => isWhite(p) || (onLine(y) && isGridGray(p))).length;
      if (whites >= 2) {
        // 칸 사이 흰 틈 또는 빈 시간
        close(y);
        continue;
      }
      // 바탕색 후보: 세 줄 중 가장 밝은 픽셀 (글자는 어둡다)
      const bg = ps.reduce((a, b) => (a[0] + a[1] + a[2] >= b[0] + b[1] + b[2] ? a : b));
      const isFill = Math.max(...bg) > 215 && !isWhite(bg);
      if (!cur) {
        cur = { top: y, color: bg, samples: isFill ? [bg] : [], changeAt: null, newColor: null };
        continue;
      }
      if (!isFill || onLine(y)) continue; // 글자 줄·눈금선은 같은 칸
      if (dist(bg, cur.color) <= 40) {
        cur.samples.push(bg);
        cur.changeAt = null;
        if (cur.samples.length < 4) cur.color = bg;
        continue;
      }
      // 바탕색이 바뀜: 계속 바뀐 색이면 새 칸
      if (cur.changeAt === null || !cur.newColor || dist(bg, cur.newColor) > 40) {
        cur.changeAt = y;
        cur.newColor = bg;
      } else if (y - cur.changeAt >= SPLIT_ROWS) {
        const at: number = cur.changeAt;
        const nc: RGB = cur.newColor;
        close(at);
        cur = { top: at, color: nc, samples: [nc], changeAt: null, newColor: null };
      }
    }
    close(bottom);
  }
  // 시간표가 상자 아래(또는 친구 목록 등)로 가려져 잘린 경우: 가장 아래까지 내려간 칸이
  // 가로 테두리(폭의 90% 이상이 흰색이 아닌 줄)에 닿아 있으면 끝 시각을 알 수 없다고 본다
  const lowest = Math.max(...blocks.map((b) => b.bottom), 0);
  const x0 = colX[0];
  const x1 = colX[colX.length - 1];
  const edgeRow = (yy: number) => {
    let n = 0;
    for (let x = x0; x < x1; x++) if (!isWhite(pixel(img, x, yy))) n++;
    return n > (x1 - x0) * 0.9;
  };
  const cutLowest = [lowest - 2, lowest - 1, lowest, lowest + 1, lowest + 2].some((yy) => yy >= 0 && yy < img.height && edgeRow(yy));
  for (const b of blocks) b.truncated = cutLowest && b.bottom >= lowest - 3;
  return blocks;
}

/**
 * AI가 읽은 수업(요일·대략 시각·글자)과 픽셀로 잰 칸을 맞춰, 시각은 픽셀 값으로 바꾼다.
 * AI가 놓친 칸은 '이름 확인 필요' 수업으로 넣어 사용자가 고치게 한다.
 */
export function mergeWithBlocks<T extends { name: string; slots: { day: number; start_min: number; end_min: number }[] }>(
  courses: T[],
  blocks: DetectedBlock[],
): { courses: T[]; unmatched: DetectedBlock[] } {
  const used = new Set<number>();
  const out = courses.map((c) => ({
    ...c,
    slots: c.slots.map((s) => {
      let bestI = -1;
      let bestD = Infinity;
      blocks.forEach((b, i) => {
        if (used.has(i)) return;
        // 같은 요일 우선, AI가 요일을 한 칸 틀린 경우도 시각이 거의 같으면 맞춘다
        const d = Math.abs(b.start_min - s.start_min) + (b.day === s.day ? 0 : 90 * Math.abs(b.day - s.day));
        if (d < bestD) {
          bestD = d;
          bestI = i;
        }
      });
      if (bestI < 0 || bestD > 120) return { ...s, start_min: snap30(s.start_min), end_min: Math.max(snap30(s.end_min), snap30(s.start_min) + 30) };
      used.add(bestI);
      const b = blocks[bestI];
      // 잘린 칸은 끝 시각이 안 보이므로 AI가 읽은 끝 시각(30분 단위)을 쓴다
      const end = b.truncated ? Math.max(snap30(s.end_min), b.start_min + 30) : b.end_min;
      return { ...s, day: b.day, start_min: b.start_min, end_min: end };
    }),
  }));
  return { courses: out, unmatched: blocks.filter((_, i) => !used.has(i)) };
}

/** 칸 하나의 잘라낼 영역 (테두리 1px 안쪽) */
export function blockRect(grid: GridInfo, b: DetectedBlock) {
  const xl = grid.colX[b.day] + 1;
  const xr = grid.colX[b.day + 1] - 1;
  return { left: xl, top: b.top + 1, width: Math.max(xr - xl, 4), height: Math.max(b.bottom - b.top - 2, 4) };
}

/** 왼쪽 시간 숫자 칸의 맨 위 한 칸 (첫 시각 숫자, 보통 9) */
export function firstHourRect(grid: GridInfo) {
  return { left: 0, top: grid.lineY[0], width: Math.max(grid.colX[0], 8), height: Math.max(Math.round(grid.hourPx * 0.8), 8) };
}
