// اختبار انحدار شامل: كل عطل اتلقى قبل كده لازم يفضل متصلّح.
// التشغيل: شغّل التطبيق (NEXT_PUBLIC_E2E=1 npm run build && npx next start -p 3100) ثم: npm test
import fs from "fs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { launch, BASE, sleep, clickByText, newBoard, objects, panelCount, savedCount, stroke, tool } from "./lib.mjs";

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? "PASS" : "FAIL", "-", m); };
const { browser, page, errors, touch } = await launch();

// ───────── التراجع والإعادة
await newBoard(page);
await tool(page, "قلم حر");
await stroke(page, 400, 300, 600, 380);
await stroke(page, 400, 450, 650, 420);
await stroke(page, 700, 300, 800, 500);
const seq = [];
for (const [label, steps] of [["تراجع", 4], ["إعادة", 2]]) {
  for (let i = 0; i < steps; i++) { await tool(page, label); await sleep(450); seq.push(await savedCount(page)); }
}
ok(JSON.stringify(seq) === "[2,1,0,0,1,2]", "undo/redo walks the timeline exactly: " + JSON.stringify(seq));
await stroke(page, 300, 600, 500, 650);
ok((await savedCount(page)) === 3, "drawing after undo/redo works");
await page.reload({ waitUntil: "networkidle0" }); await sleep(1200);
ok((await objects(page)) === 3 && (await panelCount(page)) === 3, "board restored after reload (3 strokes, 3 layers)");

// ───────── الأشكال والملاحظة اللاصقة والقوالب
await newBoard(page);
await tool(page, "مستطيل");
await page.mouse.move(400, 300); await page.mouse.down();
for (let i = 1; i <= 10; i++) await page.mouse.move(400 + i * 20, 300 + i * 10);
await page.mouse.up(); await sleep(300);
const r = await page.evaluate(() => { const o = window.__canvas.getObjects()[0]; return [o.left, o.top, o.width * o.scaleX, o.height * o.scaleY].map(Math.round); });
ok(Math.abs(r[0] - 400) < 4 && Math.abs(r[1] - 300) < 4 && Math.abs(r[2] - 200) < 5, "rectangle lands exactly where dragged " + JSON.stringify(r));
const sel = await page.evaluate(() => window.__canvas.getObjects()[0].cornerColor);
ok(sel === "#1f6f63", "selection handles use the brand colour");

await tool(page, "ملاحظة لاصقة");
await page.mouse.click(800, 450); await sleep(400);
ok((await panelCount(page)) === 2, "sticky note (rect+text) is ONE layer");
await page.mouse.click(1100, 700);
await page.mouse.click(850, 470, { count: 2 }); await sleep(400);
await page.keyboard.down("Control"); await page.keyboard.press("a"); await page.keyboard.up("Control");
await page.keyboard.type("hello"); await sleep(200);
await page.mouse.click(1100, 700); await sleep(300);
const texts = await page.evaluate(() => window.__canvas.getObjects().filter((o) => o.type === "textbox").map((o) => o.text));
ok(texts.includes("hello"), "typing inside a sticky note works");

await tool(page, "القوالب"); await sleep(300);
await clickByText(page, "button", "خريطة ذهنية"); await sleep(600);
ok((await panelCount(page)) === 3, "mind-map template adds exactly ONE layer");
const c = await page.evaluate(() => { const o = window.__canvas.getObjects().find((x) => x.type === "textbox" && x.text.includes("الفكرة الرئيسية")); const p = o.getCenterPoint(); return [Math.round(p.x), Math.round(p.y)]; });
await tool(page, "تحديد"); await page.mouse.click(1200, 100);
await page.mouse.click(c[0], c[1], { count: 2 }); await sleep(400);
await page.keyboard.down("Control"); await page.keyboard.press("a"); await page.keyboard.up("Control");
await page.keyboard.type("MYIDEA"); await sleep(200);
await page.mouse.click(1200, 100); await sleep(300);
ok((await page.evaluate(() => window.__canvas.getObjects().some((o) => o.text === "MYIDEA"))), "typing inside a mind-map node works");

// ───────── الطبقات
const trash = await page.evaluate(() => getComputedStyle(document.querySelector('[title="حذف"]').parentElement).opacity);
ok(trash === "1", "layer delete button is always visible (no hover needed)");

// ───────── الممحاة
await newBoard(page);
await tool(page, "قلم حر"); await stroke(page, 450, 350, 650, 350);
await tool(page, "ملاحظة لاصقة"); await page.mouse.click(800, 450); await sleep(300);
await tool(page, "ممحاة");
await page.mouse.move(430, 350); await page.mouse.down();
for (let i = 0; i <= 20; i++) await page.mouse.move(430 + i * 12, 350);
await page.mouse.move(850, 520); await page.mouse.move(900, 520);
await page.mouse.up(); await sleep(400);
ok((await objects(page)) === 2, "eraser deletes the stroke but never the sticky note");

// ───────── لوحة التحكم (الداشبورد)
await page.goto(BASE, { waitUntil: "networkidle0" });
const boardsBefore = await page.evaluate(() => JSON.parse(localStorage.getItem("sabourty:boards:index")).length);
await page.evaluate(() => document.querySelector('button svg circle[r="1.1"]').closest("button").click()); await sleep(300);
const hit = await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "حذف"); const r = b.getBoundingClientRect(); return b.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); });
ok(hit, "dashboard card menu is on top and clickable");
await clickByText(page, "button", "حذف"); await sleep(400);
ok((await page.evaluate(() => JSON.parse(localStorage.getItem("sabourty:boards:index")).length)) === boardsBefore - 1, "board deleted from the dashboard");

// ───────── اللمس
await newBoard(page);
await tool(page, "قلم حر");
await touch("touchStart", [[400, 300]]);
for (let i = 1; i <= 8; i++) await touch("touchMove", [[400 + i * 20, 300 + i * 5]]);
await touch("touchEnd", []); await sleep(300);
const n0 = await objects(page);
ok(n0 === 1, "one-finger drag draws");
await touch("touchStart", [[600, 500]]); await sleep(60);
await touch("touchStart", [[600, 500], [700, 500]]); await sleep(60);
for (let i = 1; i <= 10; i++) await touch("touchMove", [[600 - i * 10, 500], [700 + i * 10, 500]]);
await touch("touchEnd", []); await sleep(400);
ok((await objects(page)) === n0, "two-finger pinch with the pen selected draws NOTHING");
ok((await page.evaluate(() => window.__canvas.getZoom())) > 1.5, "pinch zooms");
await touch("touchStart", [[300, 650]]);
for (let i = 1; i <= 6; i++) await touch("touchMove", [[300 + i * 20, 650]]);
await touch("touchEnd", []); await sleep(300);
ok((await objects(page)) === n0 + 1, "pen still draws after a pinch");
await page.evaluate(() => window.__canvas.setViewportTransform([1, 0, 0, 1, 0, 0]));
await tool(page, "ملاحظة لاصقة"); await page.mouse.click(900, 200); await sleep(300);
await tool(page, "تحديد"); await page.mouse.click(1100, 700);
for (let i = 0; i < 2; i++) { await touch("touchStart", [[950, 220]]); await sleep(40); await touch("touchEnd", []); await sleep(120); }
await sleep(300);
ok(await page.evaluate(() => !!window.__canvas.getActiveObject()?.isEditing), "tap (select) then tap (edit) opens text editing on touch");

// ───────── PDF
const doc = await PDFDocument.create(); const font = await doc.embedFont(StandardFonts.HelveticaBold);
for (const [w, h] of [[595, 842], [842, 595], [595, 842]]) {
  const p = doc.addPage([w, h]); p.drawRectangle({ x: 20, y: 20, width: w - 40, height: h - 40, borderColor: rgb(0.1, 0.4, 0.4), borderWidth: 4 });
  p.drawText("PAGE", { x: 60, y: h - 120, size: 60, font });
}
fs.writeFileSync("/tmp/test.pdf", await doc.save());
await newBoard(page);
await (await page.$('input[type=file][accept="application/pdf"]')).uploadFile("/tmp/test.pdf");
await page.waitForFunction(() => document.body.innerText.includes("1 / 3"), { timeout: 30000 }).catch(() => {});
const info = () => page.evaluate(() => { const c = window.__canvas, b = c.backgroundImage; return { w: c.getWidth(), h: c.getHeight(), bw: b && Math.round(b.width * b.scaleX), bh: b && Math.round(b.height * b.scaleY), n: c.getObjects().length, nav: document.body.innerText.match(/\d+ \/ \d+/)?.[0] }; });
let i1 = await info();
ok(i1.nav === "1 / 3" && Math.abs(i1.bw - i1.w) <= 1 && Math.abs(i1.bh - i1.h) <= 1, "PDF imported, background fits the page exactly " + JSON.stringify(i1));
await tool(page, "قلم حر"); await stroke(page, 450, 400, 650, 450);
await tool(page, "الصفحة التالية"); await sleep(1200);
let i2 = await info();
ok(i2.nav === "2 / 3" && i2.w === 842 && i2.h === 595, "next page loads (landscape) without hanging");
await stroke(page, 450, 300, 650, 330);
await tool(page, "الصفحة السابقة"); await sleep(1200);
ok((await info()).n === 1, "each page keeps its own annotations");
await page.reload({ waitUntil: "networkidle0" }); await sleep(1500);
const i4 = await info(); ok(i4.nav === "1 / 3" && i4.n === 1 && !!i4.bw, "PDF board restored after reload");

// ───────── الفيديو
await newBoard(page);
await tool(page, "قلم حر"); await stroke(page, 400, 300, 600, 340); await stroke(page, 400, 400, 600, 440); await stroke(page, 400, 500, 600, 540);
await tool(page, "تصدير فيديو"); await sleep(300);
await clickByText(page, "button", "ابدأ التسجيل المباشر"); await sleep(1500);
const pill = await page.evaluate(() => document.body.innerText.includes("جارِ التسجيل المباشر"));
const blocked = await page.evaluate(() => { const e = document.elementFromPoint(640, 400); return e && e.closest(".fixed.inset-0") ? true : false; });
ok(pill && !blocked, "live recording shows a small pill and does NOT block the canvas");
const before = await objects(page); await stroke(page, 300, 600, 500, 650);
ok((await objects(page)) === before + 1, "can draw while live-recording");
await clickByText(page, "button", "إيقاف"); await sleep(1500);
ok(await page.evaluate(() => !!document.querySelector("video")), "live recording produces a video");
await clickByText(page, "button", "تجاهل"); await sleep(300);
await clickByText(page, "button", "×4"); await clickByText(page, "button", "ابدأ إعادة التشغيل والتسجيل");
const t0 = Date.now();
await page.waitForFunction(() => !!document.querySelector("video"), { timeout: 60000 }).catch(() => {});
ok(await page.evaluate(() => !!document.querySelector("video")), `session replay finishes and produces a video (${Math.round((Date.now() - t0) / 1000)}s)`);
await clickByText(page, "button", "تجاهل"); await clickByText(page, "button", "✕").catch(() => {});

// ───────── إعدادات الكانفا (الخلفية والشبكة)
await newBoard(page);
const bgKind = () => page.evaluate(() => { const b = window.__canvas.backgroundColor; return typeof b === "string" ? b : "pattern"; });
ok((await bgKind()) === "pattern", "empty board shows the dot grid (auto mode)");
await tool(page, "قلم حر"); await stroke(page, 400, 300, 600, 380);
ok((await bgKind()) === "#ffffff", "grid disappears once drawing starts (auto mode)");
const alpha = await page.evaluate(() => { const c = document.createElement("canvas"); const img = new Image(); c.width = 20; c.height = 20; return new Promise((res) => { img.onload = () => { const x = c.getContext("2d"); x.drawImage(img, 0, 0); res(x.getImageData(2, 2, 1, 1).data[3]); }; img.src = window.__canvas.toDataURL({ format: "png" }); }); });
ok(alpha === 255, "exported image has an opaque background (not transparent/black)");
await tool(page, "إعدادات اللوحة"); await sleep(200);
await clickByText(page, "button", "نقاط"); await sleep(200);
ok((await bgKind()) === "pattern", "grid 'dots' stays visible while drawing");
await page.click('[aria-label="سبورة داكنة"]'); await sleep(300);
await clickByText(page, "button", "بدون"); await sleep(200);
ok((await bgKind()) === "#1f2420", "dark board background applied, grid off");
ok((await page.evaluate(() => window.__canvas.freeDrawingBrush.color)) === "#ffffff", "pen switches to white on a dark board");
await tool(page, "تراجع"); await sleep(500);
ok((await bgKind()) === "#1f2420", "background survives undo");
const saved = await page.evaluate(() => { const b = JSON.parse(localStorage.getItem("sabourty:board:" + location.pathname.split("/").pop())); return { bg: b.settings?.background, grid: b.settings?.grid, hasBgInJson: !!(b.canvasJSON && "background" in b.canvasJSON) }; });
ok(saved.bg === "#1f2420" && saved.grid === "none" && !saved.hasBgInJson, "settings saved per board, not inside element JSON " + JSON.stringify(saved));
await page.reload({ waitUntil: "networkidle0" }); await sleep(1200);
ok((await bgKind()) === "#1f2420", "dark background restored after reload");

// ───────── محتوى الفيديو (قبل التشفير): بيضا + الخط ظاهر وهو بيترسم
await newBoard(page);
await tool(page, "قلم حر");
await tool(page, "تصدير فيديو"); await sleep(300);
await clickByText(page, "button", "ابدأ التسجيل المباشر"); await sleep(1000);
await page.mouse.move(400, 400); await page.mouse.down();
for (let i = 1; i <= 25; i++) { await page.mouse.move(400 + i * 8, 400 + Math.sin(i / 3) * 40); await sleep(30); }
const mid = await page.evaluate(() => { const c = window.__composite?.canvas; const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let dark = 0, n = 0, bright = 0; for (let i = 0; i < d.length; i += 28) { n++; const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; if (l < 120) dark++; else if (l > 235) bright++; } return { dark, bright: bright / n }; });
await page.mouse.up();
ok(mid.dark > 0 && mid.bright > 0.85, "live recording shows the stroke WHILE it is being drawn, on a white background");
await clickByText(page, "button", "إيقاف"); await sleep(1500);
await clickByText(page, "button", "تجاهل");

console.log("\nconsole/page errors:", errors.length ? errors : "none");
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
