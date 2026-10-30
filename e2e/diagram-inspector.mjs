// لوحة الخصائص: الشكل، المظهر، الخط (جوجل)، المحاذاة، وخصائص الرابط
import { launch, newBoard, sleep, tool } from "./lib.mjs";

let failed = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${extra}`); if (!ok) failed++; };
const { browser, page, errors } = await launch();
await newBoard(page);
const drag = async (x1, y1, x2, y2) => { await page.mouse.move(x1, y1); await page.mouse.down(); await page.mouse.move((x1 + x2) / 2, (y1 + y2) / 2, { steps: 4 }); await page.mouse.move(x2, y2, { steps: 4 }); await page.mouse.up(); await sleep(150); };
const node = (fn) => page.evaluate(fn);
const click = (label) => page.click(`[aria-label="${label}"]`);
await page.evaluate(() => document.querySelector('[aria-label="الطبقات"]')?.click());

await tool(page, "الأشكال"); await tool(page, "مستطيل"); await drag(300, 300, 480, 390);
await tool(page, "الأشكال"); await tool(page, "دائرة"); await drag(700, 280, 820, 400);
await tool(page, "تحديد");
await page.mouse.click(390, 345);
await sleep(300);
check("لوحة الخصائص ظهرت عند اختيار عقدة", (await page.$('[aria-label="خصائص العنصر"]')) !== null);

// كتابة نص
await page.mouse.click(390, 345);
await sleep(100);
await page.keyboard.type("اختبار الخطوط", { delay: 10 });
await page.keyboard.press("Escape");
await sleep(150);

// الخط
await click("نوع الخط");
await sleep(300);
const rowsBefore = await page.$$eval('button[aria-label]', (els) => els.length);
await page.type('[aria-label="ابحث عن خط"]', "Cairo");
await sleep(300);
await page.click('button[aria-label="Cairo"]');
await sleep(500);
check("اختيار خط Cairo", (await node(() => window.__canvas.getObjects()[0].fontFamily)) === "Cairo");
// كل الخطوط: عدّاد
const placeholder = await page.$eval('[aria-label="ابحث عن خط"]', (el) => el.placeholder);
check("البحث بين كل خطوط جوجل (1908)", /١٬٩٠٨|1,908|1908/.test(placeholder), placeholder);
await page.keyboard.press("Escape");

// المحاذاة والاتجاه الرأسي
await click("محاذاة لليسار");
await click("النص لأعلى");
const al = await node(() => { const n = window.__canvas.getObjects()[0]; return [n.textAlign, n.verticalAlign]; });
check("محاذاة النص يسار + أعلى", al[0] === "left" && al[1] === "top", JSON.stringify(al));
await click("خط عريض");
check("خط عريض", (await node(() => window.__canvas.getObjects()[0].fontWeight)) === "bold");
await click("تكبير الخط");
check("تكبير الخط", (await node(() => window.__canvas.getObjects()[0].fontSize)) === 20);

await page.screenshot({ path: "/tmp/inspector-dbg.png" });
await click("الشكل");
await click("سداسي");
check("تغيير الشكل لسداسي", (await node(() => window.__canvas.getObjects()[0].shape)) === "hexagon");
// المظهر
await click("المظهر");
await click("مظهر بطاقة");
check("تغيير المظهر لبطاقة", (await node(() => window.__canvas.getObjects()[0].look)) === "card");
await click("مظهر شكل عادي");

// رابط
await tool(page, "الأشكال"); await tool(page, "سهم"); await drag(400, 340, 760, 340);
await sleep(300);
check("خصائص الرابط ظاهرة", (await page.$('[aria-label="رابط متعرّج"]')) !== null);
await click("رابط متعرّج");
check("الرابط بقى متعرّج", (await node(() => window.__canvas.getObjects().find((o) => o.type === "flowconnector").route)) === "elbow");
await click("رؤوس الأسهم");
await click("بداية: نقطة");
check("رأس البداية نقطة", (await node(() => window.__canvas.getObjects().find((o) => o.type === "flowconnector").startHead)) === "dot");
await page.keyboard.press("Escape");
await page.screenshot({ path: "/tmp/inspector1.png" });
check("مفيش أخطاء", errors.length === 0, errors.join("|").slice(0, 300));
await browser.close();
process.exit(failed ? 1 : 0);
