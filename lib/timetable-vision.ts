// 에브리타임 시간표 스크린샷에서 수업 칸의 '위치'를 픽셀로 직접 재서 정확한 시각을 구한다 (순수 함수, 테스트 대상)
// AI는 글자(과목명·교수명·강의실)와 요일을 읽고, 시각은 여기서 잰 칸의 위·아래 끝으로 정한다.
// 1) 시간 눈금 가로선·요일 세로선을 찾는다. 수업 칸이 선을 가리므로, 보이는 선들의 '일정한 간격'으로 나머지를 복원한다.
// 2) 요일 칸마다 세로로 훑어 흰 바탕이 아닌 구간(수업 칸)을 찾는다. 색이 바뀌면 다른 칸으로 나눈다.
// 3) 칸의 위·아래 끝을 시각으로 바꾸고 30분 단위로 맞춘다 (모든 수업은 30분 단위로 시작·끝난다).

export type RawImage = { data: Uint8Array | Buffer; width: number; height: number; channels: number };
/** truncated: 칸 아래가 시간표 상자 끝(스크롤)에서 잘려 끝 시각을 알 수 없음 */
export type DetectedBlock = { day: number; start_min: number; end_min: number; top: number; bottom: number; color: [number, number, number]; truncated: boolean };
/** bottom: 시간표 상자가 보이는 맨 아래 (마지막 눈금선보다 아래일 수 있다 — 중간에 잘린 화면) */
export type GridInfo = { lineY: number[]; colX: number[]; hourPx: number; bottom?: number };

type RGB = [number, number, number];

function pixel(img: RawImage, x: number, y: number): RGB {
  const i = (y * img.width + x) * img.channels;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
}
const isGridGray = ([r, g, b]: RGB) => {
  const mx = Math.max(r, g, b);
  return mx - Math.min(r, g, b) < 14 && mx > 195 && mx < 246;
};
// 에타 수업 칸은 서로 아주 비슷한 파스텔색이라(예: 연두 224,241,233 / 하늘 224,232,245) 조금만 달라도 다른 칸이다.
// 한 칸 안의 바탕색은 거의 똑같다(눈금선이 지나는 줄도 차이 6 이하).
const COLOR_SAME = 12;
// 칸 경계로 나누는 기준: 가장 비슷한 에타 색 쌍도 20 이상 차이 나고, 압축 잡음은 15 정도까지 나온다
const SPLIT_DIST = 17;
const isWhite = ([r, g, b]: RGB) => r > 246 && g > 246 && b > 246;
const dist = (a: RGB, b: RGB) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

/**
 * 다크 모드 캡처를 라이트 모드처럼 바꾼다 (라이트 모드면 그대로 돌려준다).
 * 다크 모드: 검은 바탕(≈17)·어두운 회색 눈금선(≈40)·밝은 회색 시간 숫자, 수업 칸은 조금 어두운 파스텔.
 * 바탕·선 밝기의 무채색만 뒤집으면 바탕은 흰색, 눈금선은 옅은 회색이 되고, 수업 칸 색은 그대로라 같은 방식으로 잴 수 있다.
 */
export function toLightMode(img: RawImage): RawImage {
  const { width: W, height: H, channels: ch } = img;
  const lum: number[] = [];
  for (let y = 0; y < H; y += Math.max(1, Math.floor(H / 60)))
    for (let x = 0; x < W; x += Math.max(1, Math.floor(W / 40))) {
      const [r, g, b] = pixel(img, x, y);
      lum.push((r + g + b) / 3);
    }
  lum.sort((a, b) => a - b);
  const bgLum = lum[lum.length >> 1];
  if (bgLum >= 90) return img;
  const out = Buffer.from(img.data);
  for (let i = 0; i < out.length; i += ch) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const mx = Math.max(r, g, b);
    // 바탕·눈금선 밝기까지만 뒤집는다 (칸 안 글자(≈60~100)까지 뒤집으면 흰 틈으로 오해한다)
    // (거의 검은 픽셀은 JPEG 색 번짐이 있어도 바탕으로 본다)
    if (mx <= bgLum + 30) {
      // 바탕(bgLum) → 255, 눈금선(≈40) → ≈230
      const v = Math.max(0, Math.min(255, Math.round(255 - ((r + g + b) / 3 - bgLum))));
      out[i] = out[i + 1] = out[i + 2] = v;
    }
  }
  return { ...img, data: out };
}

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

/**
 * 시간 눈금 가로선과 요일 세로선.
 * 에타 화면마다 위쪽(탭·이름·학기 선택)과 아래쪽(친구 검색·목록) 모양이 달라서, 그쪽 선을 눈금으로 착각하지 않도록
 * 1) 시간표 상자 안에만 있는 '요일 세로선'을 먼저 찾고, 2) 그 세로선이 지나는 높이를 시간표 범위로 잡은 뒤,
 * 3) 그 범위 안에서만 시간 가로선을 찾는다.
 */
export function detectGrid(img: RawImage): GridInfo | null {
  const { width: W, height: H } = img;
  const d = Math.max(2, Math.round(W * 0.006));
  // 가는 세로선: 회색이고 양옆(±d)은 흰색 (넓은 회색 상자·글자는 제외된다)
  const thinV = (x: number, y: number) =>
    x > d && x < W - d && isGridGray(pixel(img, x, y)) && isWhite(pixel(img, x - d, y)) && isWhite(pixel(img, x + d, y));

  // 1) 요일 세로선
  const colCands: number[] = [];
  const colYs = new Map<number, number[]>();
  for (let x = d + 1; x < W - d - 1; x++) {
    const ys: number[] = [];
    for (let y = 0; y < H; y++) if (thinV(x, y)) ys.push(y);
    if (ys.length > H * 0.08) {
      colCands.push(x);
      colYs.set(x, ys);
    }
  }
  const cols = fitProgression(colCands, W * 0.1, W * 0.25, W);
  if (!cols || cols.lines.length < 3) return null;

  // 2) 시간표 범위: 요일선 위치들이 '모두 함께' 흰색이 아닌(회색 선 또는 수업 칸) 높이의 가장 긴 구간.
  //    상자 밖은 그 위치들이 대부분 흰 바탕이고, 글자·밑줄은 한두 줄짜리라 긴 구간이 되지 못한다.
  const hit = new Uint8Array(H);
  for (const cx of cols.lines)
    for (let y = 0; y < H; y++) if ([cx - 1, cx, cx + 1].some((x) => x >= 0 && x < W && !isWhite(pixel(img, x, y)))) hit[y]++;
  const need = Math.max(2, Math.ceil(cols.lines.length * 0.6));
  const maxHole = Math.round(W * 0.02); // 잠깐 끊긴 곳은 이어 본다
  let run: [number, number] | null = null;
  let best: [number, number] | null = null;
  for (let y = 0; y < H; y++) {
    if (hit[y] < need) continue;
    if (run && y - run[1] <= maxHole) run[1] = y;
    else run = [y, y];
    if (!best || run[1] - run[0] > best[1] - best[0]) best = [run[0], run[1]];
  }
  if (!best || best[1] - best[0] < H * 0.1) return null;
  const gridTop = best[0];
  const gridBottom = best[1] + 2;

  // 3) 그 범위 안의 시간 가로선 (요일 칸 영역 폭의 25% 이상이 회색인 줄)
  const x0 = cols.lines[0];
  const x1 = cols.lines[cols.lines.length - 1];
  const rowCands: number[] = [];
  for (let y = Math.max(0, gridTop - 2); y <= Math.min(H - 1, gridBottom + 2); y++) {
    let g = 0;
    // 가는 가로선만: 위아래(±d)와 색이 달라야 한다 (회색에 가까운 수업 칸 안쪽은 선이 아니다)
    for (let x = x0; x < x1; x++) {
      const p = pixel(img, x, y);
      if (isGridGray(p) && dist(p, pixel(img, x, Math.max(0, y - d))) > 12 && dist(p, pixel(img, x, Math.min(H - 1, y + d))) > 12) g++;
    }
    if (g > (x1 - x0) * 0.25) rowCands.push(y);
  }
  const rows = fitProgression(rowCands, W * 0.06, W * 0.22, gridBottom + 3);
  if (!rows || rows.lines.length < 3) return null;

  // 왼쪽 끝 시간 숫자 칸까지 늘린다
  const colX = [...cols.lines];
  while (colX[0] - cols.gap > W * 0.02) colX.unshift(Math.round(colX[0] - cols.gap));
  // 오른쪽은 월~금 5칸이 안 될 때만 늘린다 (상자 오른쪽 바깥 여백을 토요일로 착각하지 않게)
  // (화면 끝에 걸쳐 오른쪽 테두리가 잘린 경우도 마지막 요일 칸으로 넣는다)
  while (colX.length - 1 < 5 && colX[colX.length - 1] + cols.gap * 0.85 < W) colX.push(Math.min(W - 1, Math.round(colX[colX.length - 1] + cols.gap)));

  // 기준: 왼쪽 시간 숫자(9, 10, 11 …)는 수업 칸에 가려지지 않는다. 숫자 간격 = 1시간 높이이고,
  // 각 숫자 바로 위의 선이 그 시각의 선이다. (그 위의 요일 머리줄 선·화면 위쪽 선을 눈금으로 잘못 잡지 않게 한다)
  const labels = hourLabels(img, colX[0], gridTop, gridBottom);
  let hourPx = rows.gap;
  let first = rows.lines.find((y) => y >= gridTop - 2) ?? rows.lines[0];
  if (labels) {
    // 선이 수업 칸에 많이 가려지면 1.5배·2배 간격이 더 잘 맞아 보일 수 있다 → 숫자 간격 근처에서 다시 맞춘다
    if (Math.abs(labels.gap - hourPx) / labels.gap > 0.04) {
      const refit = fitProgression(rowCands, labels.gap * 0.96, labels.gap * 1.04, gridBottom + 3);
      hourPx = refit && refit.lines.length >= 3 ? refit.gap : labels.gap;
    }
    const l0 = labels.tops[0];
    const above = rowCands.filter((c) => c <= l0 && c >= l0 - hourPx * 0.45);
    first = above.length ? Math.max(...above) : Math.round(l0 - hourPx * 0.15);
  }
  // 첫 선에서 한 시간씩 내려가며, 근처에 실제 선이 보이면 그 위치로 맞춘다 (축소 화면의 누적 오차 보정)
  const tol = Math.max(2, hourPx * 0.06);
  const lineY: number[] = [first];
  for (let y = first + hourPx; y <= gridBottom + tol; ) {
    const near = rowCands.filter((c) => Math.abs(c - y) <= tol);
    const at = near.length ? near.reduce((a, b) => (Math.abs(a - y) <= Math.abs(b - y) ? a : b)) : Math.round(y);
    if (at > gridBottom + 2) break;
    lineY.push(at);
    y = at + hourPx;
  }
  if (lineY.length < 3) return null;
  return { lineY, colX, hourPx, bottom: Math.max(lineY[lineY.length - 1], gridBottom - 2) };
}

/** 왼쪽 시간 숫자 칸의 숫자 덩어리 윗끝들과 그 간격 (못 찾으면 null) */
export function hourLabels(img: RawImage, timeColRight: number, top: number, bottom: number): { tops: number[]; gap: number } | null {
  const x0 = Math.round(timeColRight * 0.1);
  const x1 = Math.max(x0 + 2, timeColRight - 2);
  const isDark = (x: number, y: number) => {
    const [r, g, b] = pixel(img, x, y);
    return r + g + b < 3 * 185;
  };
  // 위아래로 계속 어두운 세로줄(화면 가장자리 테두리 등)은 숫자가 아니다
  const xs: number[] = [];
  for (let x = x0; x < x1; x++) {
    let n = 0;
    for (let y = top; y <= bottom; y++) if (isDark(x, y)) n++;
    if (n < (bottom - top + 1) * 0.5) xs.push(x);
  }
  const dark: boolean[] = [];
  for (let y = top; y <= bottom; y++) dark.push(xs.some((x) => isDark(x, y)));
  const tops: number[] = [];
  for (let i = 0; i < dark.length; i++) if (dark[i] && (i === 0 || !dark[i - 1])) tops.push(top + i);
  if (tops.length < 3) return null;
  const fit = fitProgression(tops, img.width * 0.05, img.width * 0.25, img.height);
  if (!fit || fit.lines.length < 3) return null;
  // 간격에 맞는 실제 숫자 위치만 (첫 숫자가 맨 위 시각)
  const on = tops.filter((t) => fit.lines.some((l) => Math.abs(l - t) <= Math.max(2, fit.gap * 0.08)));
  return on.length >= 3 ? { tops: on, gap: fit.gap } : null;
}

const snap30 = (m: number) => Math.round(m / 30) * 30;

/**
 * 요일 칸마다 수업 칸(흰 바탕이 아닌 구간)을 찾아 시각으로 바꾼다.
 * startHour: 맨 위 가로선의 시각(에타 왼쪽 첫 숫자, 보통 9)
 */
export function detectBlocks(img: RawImage, grid: GridInfo, startHour: number): DetectedBlock[] {
  const { lineY, colX, hourPx } = grid;
  const top = lineY[0];
  const bottom = grid.bottom ?? lineY[lineY.length - 1];
  // 고해상도 캡처는 선이 2~3px로 두껍고, 숫자 간격으로 다시 맞춘 선은 몇 px 어긋날 수 있어 여유를 해상도에 비례시킨다
  const lineTol = Math.max(1, Math.round(hourPx * 0.03));
  const onLine = (y: number) => lineY.some((l) => Math.abs(l - y) <= lineTol);
  const blocks: DetectedBlock[] = [];


  for (let day = 0; day < colX.length - 1; day++) {
    const xl = colX[day];
    const xr = colX[day + 1];
    // 줄마다 칸 안쪽 픽셀들의 '중앙값 색'을 바탕색으로 본다. 글자는 일부라 중앙값을 바꾸지 못하고,
    // JPEG 잡음·축소 번짐에도 흔들리지 않는다. 그 색에 가까운 픽셀이 충분히 많아야 바탕으로 인정한다.
    const pad = lineTol + 2;
    const xs: number[] = [];
    for (let x = xl + pad; x < xr - pad; x += Math.max(1, Math.floor((xr - xl) / 40))) xs.push(x);
    const median = (v: number[]) => v.sort((p, q) => p - q)[v.length >> 1];
    const mean = (v: RGB[]) => [0, 1, 2].map((c) => v.reduce((sum, p) => sum + p[c], 0) / v.length) as RGB;
    const push = (from: number, to: number, fills: RGB[]) => {
      if (to - from < hourPx * 0.35) return;
      const color = (fills.length ? mean(fills).map(Math.round) : [0, 0, 0]) as RGB;
      const start = snap30(startHour * 60 + ((from - top) / hourPx) * 60);
      const end = snap30(startHour * 60 + ((to - top) / hourPx) * 60);
      if (end > start) blocks.push({ day, start_min: start, end_min: end, top: from, bottom: to, color, truncated: false });
    };
    // 흰 틈 없이 이어진 구간 안에서, 위·아래 평균 바탕색이 확실히 다른 곳만 칸 경계로 나눈다 (한두 줄 잡음에 흔들리지 않는다)
    const minSide = Math.max(3, Math.round(hourPx * 0.2));
    const splitRegion = (from: number, to: number, fills: { y: number; c: RGB }[]) => {
      let bestK = -1;
      let bestD = SPLIT_DIST;
      for (let k = minSide; k <= fills.length - minSide; k++) {
        // 양쪽 모두 30분 칸 이상 높이여야 한다 (맨 아래 그림자 몇 줄을 칸으로 떼어내지 않게)
        if (fills[k].y - from < hourPx * 0.4 || to - fills[k].y < hourPx * 0.4) continue;
        const d = dist(mean(fills.slice(0, k).map((f) => f.c)), mean(fills.slice(k).map((f) => f.c)));
        if (d > bestD) {
          bestD = d;
          bestK = k;
        }
      }
      if (bestK < 0) return push(from, to, fills.map((f) => f.c));
      const at = fills[bestK].y;
      splitRegion(from, at, fills.slice(0, bestK));
      splitRegion(at, to, fills.slice(bestK));
    };
    let region: { top: number; fills: { y: number; c: RGB }[] } | null = null;
    for (let y = top; y <= bottom; y++) {
      // 칸 안을 지나는 시간 눈금선은 같은 칸으로 본다 (옅은 칸 색이 회색 눈금과 비슷하다)
      if (region && onLine(y)) continue;
      const ps = xs.map((x) => pixel(img, x, y));
      const bg: RGB = [median(ps.map((p) => p[0])), median(ps.map((p) => p[1])), median(ps.map((p) => p[2]))];
      if (isWhite(bg) || (onLine(y) && isGridGray(bg))) {
        // 칸 사이 흰 틈 또는 빈 시간
        if (region) splitRegion(region.top, y, region.fills);
        region = null;
        continue;
      }
      region ??= { top: y, fills: [] };
      const share = ps.filter((p) => dist(p, bg) <= 18).length / ps.length;
      if (share >= 0.5 && Math.max(...bg) > 170) region.fills.push({ y, c: bg }); // 글자가 많은 줄은 색 판단에서 뺀다
    }
    if (region) splitRegion(region.top, bottom, region.fills);
  }
  // 같은 요일에 맞닿은 같은 색 칸은 하나의 수업이다 (눈금선이나 글자 때문에 나뉜 경우 다시 붙인다)
  blocks.sort((a, b) => a.day - b.day || a.top - b.top);
  for (let i = blocks.length - 1; i > 0; i--) {
    const a = blocks[i - 1];
    const b = blocks[i];
    // 바탕색을 못 잰 칸(0,0,0: 수업 편집 화면에서 어둡게 칠해진 선택 칸 등)도 맞닿은 칸과 합친다
    const unknown = (c: RGB) => c[0] + c[1] + c[2] === 0;
    if (a.day === b.day && b.top - a.bottom <= Math.max(3, hourPx * 0.08) && (dist(a.color, b.color) <= COLOR_SAME || unknown(a.color) || unknown(b.color))) {
      if (unknown(a.color)) a.color = b.color;
      a.bottom = b.bottom;
      a.end_min = b.end_min;
      blocks.splice(i, 1);
    }
  }

  // 여러 요일(4칸 이상)에 똑같은 높이·색으로 걸친 띠는 수업이 아니라 화면의 다른 요소(검색창 등)다
  const bands = blocks.filter((b) => blocks.filter((o) => Math.abs(o.top - b.top) <= 3 && Math.abs(o.bottom - b.bottom) <= 3 && dist(o.color, b.color) <= 20).length >= 4);
  for (const b of bands) blocks.splice(blocks.indexOf(b), 1);

  // 시간표가 스크롤 상자 아래에서 잘린 경우: 에타는 잘린 아래쪽을 점점 어둡게(그림자) 칠한다.
  // 맨 아래 몇 줄이 조금 위보다 고르게 어두워졌으면 잘린 것 → 그 끝에 닿은 칸은 끝 시각을 알 수 없다.
  // (원래 아래 테두리에서 끝난 시간표는 바탕색이 끝까지 그대로다)
  const lowest = Math.max(...blocks.map((b) => b.bottom), 0);
  const x0 = colX[0];
  const x1 = colX[colX.length - 1];
  // 한 줄만 보면 압축 잡음에 흔들리므로 아래쪽 띠(0.08~0.2시간)와 위쪽 띠(0.35~0.5시간)의 평균 밝기를 비교한다
  const band = (x: number, from: number, to: number) => {
    let sum = 0;
    let n = 0;
    for (let y = Math.round(bottom - hourPx * from); y >= Math.round(bottom - hourPx * to); y--) {
      const [r, g, b] = pixel(img, x, y);
      sum += r + g + b;
      n++;
    }
    return n ? sum / n : 0;
  };
  const diffs: number[] = [];
  for (let x = x0 + 2; x < x1 - 2; x++) {
    const d = band(x, 0.35, 0.5) - band(x, 0.08, 0.2);
    if (Math.abs(d) < 60) diffs.push(d); // 글자가 걸친 곳은 뺀다
  }
  diffs.sort((p, q) => p - q);
  const faded = diffs.length > 10 && diffs[Math.floor(diffs.length / 2)] >= 6;
  // 상자가 눈금선이 아닌 곳(시간 중간)에서 끝났으면 화면에서 잘린 것이다
  const midCut = !lineY.some((l) => Math.abs(l - bottom) <= lineTol + 2);
  const cutLowest = (faded || midCut) && lowest >= bottom - lineTol * 2 - 2;
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
