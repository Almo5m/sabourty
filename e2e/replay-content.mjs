// يفحص محتوى الكانفا المدمج (اللي بيتسجّل) أثناء إعادة التشغيل — من غير ما نعتمد على سرعة المشفّر.
import { launch, sleep, newBoard, tool, clickByText, stroke } from "./lib.mjs";
const { browser, page, errors } = await launch();
await newBoard(page);
await tool(page, "قلم حر");
await stroke(page, 400, 300, 700, 380); await stroke(page, 400, 450, 700, 420); await stroke(page, 450, 550, 650, 600);
await tool(page, "تصدير فيديو"); await sleep(300);
await clickByText(page, "button", "ابدأ إعادة التشغيل والتسجيل");
const sample = () => page.evaluate(() => {
  const c = window.__composite?.canvas; if (!c) return null;
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let dark = 0, bright = 0, n = 0;
  for (let i = 0; i < d.length; i += 4 * 7) { n++; const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; if (l < 120) dark++; else if (l > 235) bright++; }
  return { dark: +(dark / n * 100).toFixed(3), bright: +(bright / n * 100).toFixed(1) };
});
const series = [];
for (let i = 0; i < 60; i++) {
  await sleep(250);
  const s = await sample(); if (s) series.push(s);
  if (await page.evaluate(() => !!document.querySelector("video"))) break;
}
console.log("samples:", series.length, " dark%:", series.map((s) => s.dark).join(" "));
console.log("background bright%: min", Math.min(...series.map((s) => s.bright)));
const ok = (c, m) => console.log(c ? "PASS" : "FAIL", "-", m);
const darks = series.map((s) => s.dark);
ok(darks[0] < 0.05, "replay starts from an empty board");
ok(Math.max(...darks) > darks[0] + 0.1, "ink appears progressively");
ok(darks.every((v, i) => i === 0 || v >= darks[i - 1] - 0.02), "ink only grows (strokes are drawn, not flickering)");
ok(Math.min(...series.map((s) => s.bright)) > 85, "recorded background is white, not black");
console.log("errors:", errors);
await browser.close();
