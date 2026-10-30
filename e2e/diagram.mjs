// الأشكال والملاحظات والروابط: إنشاء، كتابة نص مربوط، ربط بين عقدتين، تتبّع الحركة
import { launch, newBoard, sleep, tool } from "./lib.mjs";

let failed = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${extra}`);
  if (!ok) failed++;
};

const { browser, page, errors } = await launch();
await newBoard(page);

const nodes = () => page.evaluate(() => window.__canvas.getObjects().filter((o) => o.type === "flownode").length);
const conns = () => page.evaluate(() => window.__canvas.getObjects().filter((o) => o.type === "flowconnector").length);
const drag = async (x1, y1, x2, y2) => {
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  await page.mouse.move((x1 + x2) / 2, (y1 + y2) / 2, { steps: 4 });
  await page.mouse.move(x2, y2, { steps: 4 });
  await page.mouse.up();
  await sleep(150);
};
const closeLayers = () => page.evaluate(() => document.querySelector('[aria-label="الطبقات"]')?.getAttribute("aria-pressed") === "true" && document.querySelector('[aria-label="الطبقات"]').click());

await closeLayers();
// --- شكلين
await tool(page, "الأشكال");
await tool(page, "مستطيل مدوّر");
await drag(300, 250, 460, 340);
check("مستطيل اترسم كعقدة", (await nodes()) === 1);
await tool(page, "الأشكال");
await tool(page, "معيّن");
await drag(700, 230, 860, 350);
check("المعيّن اترسم", (await nodes()) === 2);

// --- نص مربوط بالعقدة (نقر مزدوج → محرّر)
await page.mouse.click(380, 295);
await page.mouse.click(380, 295);
await sleep(300);
const editorOpen = await page.evaluate(() => getComputedStyle(document.querySelector('[data-node-editor]')).display !== "none");
check("النقر المزدوج بيفتح محرّر النص", editorOpen);
await page.keyboard.type("hello مرحبا", { delay: 20 });
await page.keyboard.press("Escape");
await sleep(200);
const label = await page.evaluate(() => window.__canvas.getObjects().find((o) => o.type === "flownode").label);
check("النص اتحفظ جوه العقدة", label === "hello مرحبا", JSON.stringify(label));
check("النص مش كائن منفصل", (await page.evaluate(() => window.__canvas.getObjects().length)) === 2);

// --- ربط بسهم
await tool(page, "الأشكال");
await tool(page, "سهم");
await drag(380, 295, 780, 290); // من جوه الأولى لجوه التانية
check("الرابط اتعمل", (await conns()) === 1);
const ends = await page.evaluate(() => { const c = window.__canvas.getObjects().find((o) => o.type === "flowconnector"); return [c.start.nodeId, c.end.nodeId]; });
check("الرابط متصل بالعقدتين", Boolean(ends[0]) && Boolean(ends[1]) && ends[0] !== ends[1], JSON.stringify(ends));

// --- حرّك العقدة والرابط يتبعها
const before = await page.evaluate(() => { const c = window.__canvas.getObjects().find((o) => o.type === "flowconnector"); return [c.end.x, c.end.y]; });
await tool(page, "تحديد");
await drag(780, 270, 780, 470);
await sleep(300);
const after = await page.evaluate(() => { const c = window.__canvas.getObjects().find((o) => o.type === "flowconnector"); return [c.end.x, c.end.y]; });
check("الرابط تبع العقدة لما اتحركت", Math.abs(after[1] - before[1]) > 100, `${before} → ${after}`);

// --- حفظ وإعادة تحميل
await sleep(600);
await page.reload({ waitUntil: "networkidle0" });
await sleep(1500);
check("بعد إعادة التحميل: العقد والرابط رجعوا", (await nodes()) === 2 && (await conns()) === 1);
const label2 = await page.evaluate(() => window.__canvas.getObjects().find((o) => o.type === "flownode" && o.label)?.label);
check("النص رجع", label2 === "hello مرحبا");

await page.screenshot({ path: "/tmp/diagram1.png" });
check("مفيش أخطاء", errors.length === 0, errors.join("|").slice(0, 300));
await browser.close();
process.exit(failed ? 1 : 0);
