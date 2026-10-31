// لوحة الخصائص: ثبات المكان مع التكبير والتحريك وفتح القوائم، وتعديل نص الخريطة الذهنية
import { launch, newBoard, sleep, tool, clickByText } from "./lib.mjs";

let failed = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${extra}`); if (!ok) failed++; };
const { browser, page, errors } = await launch();
await newBoard(page);
await page.evaluate(() => document.querySelector('[aria-label="الطبقات"]')?.click());
const drag = async (x1, y1, x2, y2) => { await page.mouse.move(x1, y1); await page.mouse.down(); await page.mouse.move((x1 + x2) / 2, (y1 + y2) / 2, { steps: 4 }); await page.mouse.move(x2, y2, { steps: 4 }); await page.mouse.up(); await sleep(200); };
const geo = () => page.evaluate(() => {
  const c = window.__canvas; const o = c.getActiveObject();
  const bar = document.querySelector('[aria-label="خصائص العنصر"]').getBoundingClientRect();
  const tl = o.oCoords.tl; const br = o.oCoords.br; // إحداثيات الشاشة الحقيقية
  return { bar: { x: bar.x, y: bar.y, w: bar.width, h: bar.height }, obj: { l: Math.min(tl.x, br.x), t: Math.min(tl.y, br.y), r: Math.max(tl.x, br.x), b: Math.max(tl.y, br.y) }, view: [innerWidth, innerHeight] };
});
const near = (g) => { // الشريط ملاصق للعنصر (فوقه أو تحته بمسافة معقولة) وجوه الشاشة
  const above = g.obj.t - (g.bar.y + g.bar.h);
  const below = g.bar.y - g.obj.b;
  const gap = Math.min(Math.abs(above), Math.abs(below));
  const inside = g.bar.x >= 0 && g.bar.x + g.bar.w <= g.view[0] && g.bar.y >= 0 && g.bar.y + g.bar.h <= g.view[1];
  return gap < 60 && inside;
};

await tool(page, "الأشكال"); await tool(page, "مستطيل"); await drag(500, 350, 640, 430);
await page.mouse.click(570, 390); await sleep(300);
let g = await geo();
check("لوحة الخصائص قريبة من العنصر", near(g), JSON.stringify(g));

// تكبير وتحريك: اللوحة تتبع العنصر
await page.evaluate(() => { const c = window.__canvas; c.setViewportTransform([1.8, 0, 0, 1.8, -400, -250]); c.requestRenderAll(); });
await sleep(300);
g = await geo();
check("بعد التكبير والتحريك لسه قريبة من العنصر", near(g), JSON.stringify(g.bar) + JSON.stringify(g.obj));

// فتح قائمة الخط ما بيحرّكش الشريط
const before = g.bar;
await page.click('[aria-label="نوع الخط"]'); await sleep(300);
const after = (await geo()).bar;
check("فتح قائمة الخط ما حرّكش الشريط", Math.abs(after.y - before.y) < 2 && Math.abs(after.x - before.x) < 2, `${before.y} → ${after.y}`);
await page.keyboard.press("Escape");

// العنصر خارج الشاشة جزئيًا: الشريط يفضل جوه الشاشة
await page.evaluate(() => { const c = window.__canvas; c.setViewportTransform([1, 0, 0, 1, 700, 380]); c.requestRenderAll(); });
await sleep(300);
g = await geo();
check("لما العنصر يقرّب من حافة الشاشة الشريط يفضل ظاهر", g.bar.x >= 0 && g.bar.x + g.bar.w <= g.view[0] && g.bar.y >= 0 && g.bar.y + g.bar.h <= g.view[1], JSON.stringify(g.bar));

// خريطة ذهنية: إدراج القالب ثم الكتابة في عقدة
await newBoard(page);
await page.evaluate(() => document.querySelector('[aria-label="الطبقات"]')?.getAttribute("aria-pressed") === "true" && document.querySelector('[aria-label="الطبقات"]').click());
await tool(page, "القلم الحر").catch(() => {});
await tool(page, "القوالب"); await sleep(300);
await clickByText(page, "button", "خريطة ذهنية"); await sleep(900);
const toolAfter = await page.evaluate(() => document.querySelector('[aria-label="تحديد"]').getAttribute("aria-pressed"));
check("بعد إدراج القالب الأداة رجعت تحديد", toolAfter === "true");
const center = await page.evaluate(() => { const n = window.__canvas.getObjects().find((o) => o.type === "flownode" && o.label === "فكرة فرعية 2"); const p = n.getCenterPoint(); return [p.x, p.y]; });
// نقرة واحدة تحدد، نقرة ثانية على المحدد تفتح التحرير
await page.mouse.click(center[0], center[1]); await sleep(250);
await page.mouse.click(center[0], center[1]); await sleep(350);
check("نقرتين متتاليتين على عقدة الخريطة بيفتحوا التحرير", await page.evaluate(() => getComputedStyle(document.querySelector("[data-node-editor]")).display !== "none"));
await page.keyboard.type("فرع جديد"); await page.keyboard.press("Escape"); await sleep(250);
const labels = await page.evaluate(() => window.__canvas.getObjects().filter((o) => o.type === "flownode").map((o) => o.label));
check("النص اتكتب في عقدة الخريطة", labels.includes("فرع جديد"), JSON.stringify(labels));
// زرار "تعديل النص"
await page.click('[aria-label="تعديل النص"]'); await sleep(300);
check("زرار تعديل النص بيفتح المحرّر", await page.evaluate(() => getComputedStyle(document.querySelector("[data-node-editor]")).display !== "none"));
await page.keyboard.press("Escape");
await page.screenshot({ path: "/tmp/ux1.png" });
check("مفيش أخطاء", errors.length === 0, errors.join("|").slice(0, 300));
await browser.close();
process.exit(failed ? 1 : 0);
