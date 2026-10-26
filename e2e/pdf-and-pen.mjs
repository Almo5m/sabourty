// اختبار: الشفافية، الهايلايتر، وضع PDF (ملاءمة/تكبير/تنقل/حفظ بعد إعادة التحميل)
import fs from "fs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { launch, newBoard, sleep, stroke, tool, objects } from "./lib.mjs";

let failed = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${extra}`);
  if (!ok) failed++;
};

const doc = await PDFDocument.create();
const font = await doc.embedFont(StandardFonts.HelveticaBold);
for (let i = 0; i < 5; i++) {
  const p = doc.addPage([595, 842]);
  p.drawText("Page " + (i + 1), { x: 60, y: 780, size: 40, font });
  p.drawRectangle({ x: 60, y: 600, width: 300, height: 20, color: rgb(0.2, 0.2, 0.2) });
}
fs.writeFileSync("/tmp/t.pdf", await doc.save());

const { browser, page, errors } = await launch();
await newBoard(page);

const setRange = (index, value) =>
  page.evaluate(
    (i, v) => {
      const el = document.querySelectorAll('input[type="range"]')[i];
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(el, String(v));
      el.dispatchEvent(new Event("input", { bubbles: true }));
    },
    index,
    value
  );
const lastStroke = () =>
  page.evaluate(() => {
    const o = window.__canvas.getObjects().at(-1);
    return { stroke: o.stroke, width: o.strokeWidth, op: o.globalCompositeOperation, cap: o.strokeLineCap };
  });

// --- القلم + الشفافية
await tool(page, "قلم حر");
await tool(page, "اللون والحجم والشفافية");
await setRange(1, 0.5);
await page.keyboard.press("Escape");
await stroke(page, 300, 300, 500, 340);
let s = await lastStroke();
check("شفافية القلم 50٪ بتتطبق على الخط", /rgba\(.*0\.5\)/.test(s.stroke), s.stroke);

// --- الهايلايتر
await tool(page, "هايلايتر");
await stroke(page, 300, 400, 600, 400);
s = await lastStroke();
check("الهايلايتر: شفافية 0.4 افتراضيًا", /rgba\(255, 225, 77, 0\.4\)/.test(s.stroke), s.stroke);
check("الهايلايتر: multiply وعرض عريض", s.op === "multiply" && s.width >= 14, `${s.op} ${s.width}`);
await tool(page, "قلم حر");
await stroke(page, 300, 500, 500, 520);
s = await lastStroke();
check("الرجوع للقلم بيرجّع إعدادات الحبر (50٪ لسه)", /0\.5\)/.test(s.stroke) && !s.stroke.includes("255, 225"), s.stroke);

// --- استيراد PDF
await (await page.$('input[type=file][accept="application/pdf"]')).uploadFile("/tmp/t.pdf");
for (let i = 0; i < 40; i++) {
  await sleep(500);
  const done = await page.evaluate(() => Boolean(window.__canvas.backgroundImage));
  if (done) break;
}
const view = () =>
  page.evaluate(() => {
    const c = window.__canvas;
    const z = c.getZoom();
    const v = c.viewportTransform;
    return { z, left: v[4], top: v[5], pw: 595 * z, ph: 842 * z, w: c.getWidth(), h: c.getHeight() };
  });
let v = await view();
check("الكانفا بتملى الشاشة", v.w === 1280 && v.h === 800, `${v.w}x${v.h}`);
check("الصفحة كلها ظاهرة في الشاشة", v.top >= 0 && v.top + v.ph <= v.h && v.left >= 0 && v.left + v.pw <= v.w, JSON.stringify(v));
const fitZoom = v.z;
await page.click('[aria-label="تكبير"]');
await page.click('[aria-label="تكبير"]');
v = await view();
check("التكبير بيزوّد", v.z > fitZoom * 1.3, v.z.toFixed(2));
await page.click('[aria-label="ملاءمة الصفحة"]');
v = await view();
check("زرار الملاءمة بيرجّع الصفحة كاملة", Math.abs(v.z - fitZoom) < 0.001);
await page.click('[aria-label="تصغير"]');
await page.click('[aria-label="تصغير"]');
v = await view();
check("بعد التصغير الصفحة تفضل في النص", Math.abs(v.left + v.pw / 2 - v.w / 2) < 2, `${v.left + v.pw / 2}`);

// --- رسم على الصفحة + تنقل + حفظ
await page.click('[aria-label="ملاءمة الصفحة"]');
await tool(page, "قلم حر");
await stroke(page, 500, 300, 700, 360);
check("الرسم شغال على صفحة PDF", (await objects(page)) === 1);
await page.click('[aria-label="الصفحة التالية"]');
await sleep(800);
check("الصفحة 2 فاضية", (await objects(page)) === 0);
await page.click('[aria-label="الصفحة السابقة"]');
await sleep(800);
check("الرسم رجع في الصفحة 1", (await objects(page)) === 1);
await page.click('[aria-label="الصفحة التالية"]');
await sleep(800);

const stored = await page.evaluate(() => {
  const id = location.pathname.split("/").pop();
  const raw = localStorage.getItem("sabourty:board:" + id) ?? "";
  return { size: raw.length, hasImage: raw.includes("data:image") };
});
check("localStorage مفيهوش صور الصفحات", !stored.hasImage && stored.size < 60000, JSON.stringify(stored));

await page.reload({ waitUntil: "networkidle0" });
await sleep(2500);
const after = await page.evaluate(() => ({
  bg: Boolean(window.__canvas.backgroundImage),
  pages: document.body.innerText.includes("/ 5"),
  z: window.__canvas.getZoom(),
}));
check("بعد إعادة التحميل: صورة الصفحة رجعت والصفحة ملاءمة", after.bg && after.pages && after.z > 0.5, JSON.stringify(after));

await page.screenshot({ path: "/tmp/after2.png" });
check("مفيش أخطاء في الكونسول", errors.length === 0, errors.join("|").slice(0, 200));
await browser.close();
process.exit(failed ? 1 : 0);
