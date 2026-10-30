import sharp from "sharp";
import { detectGrid, detectBlocks } from "./lib/timetable-vision.ts";
const DAYS = "월화수목금토일";
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
for (const f of process.argv.slice(2)) {
  const { data, info } = await sharp(f).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const img = { data, width: info.width, height: info.height, channels: info.channels };
  const grid = detectGrid(img);
  console.log("\n==", f, info.width + "x" + info.height, grid && { lines: grid.lineY, hourPx: grid.hourPx.toFixed(1), cols: grid.colX });
  if (!grid) continue;
  for (const b of detectBlocks(img, grid, 9)) console.log(DAYS[b.day], hhmm(b.start_min), "-", hhmm(b.end_min), b.truncated ? "(잘림)" : "", `(y ${b.top}-${b.bottom})`);
}
