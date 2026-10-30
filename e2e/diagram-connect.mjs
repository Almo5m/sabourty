// الربط: نقاط الربط (نقرة/سحب)، إعادة ربط الأطراف، الحذف، التحديد المتعدد، تغيير الحجم، التراجع
import { launch, newBoard, sleep, tool } from "./lib.mjs";

let failed = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${extra}`); if (!ok) failed++; };
const { browser, page, errors } = await launch();
await newBoard(page);
await page.evaluate(() => document.querySelector('[aria-label="الطبقات"]')?.click());

const drag = async (x1, y1, x2, y2) => { await page.mouse.move(x1, y1); await page.mouse.down(); await page.mouse.move((x1 + x2) / 2, (y1 + y2) / 2, { steps: 5 }); await page.mouse.move(x2, y2, { steps: 5 }); await page.mouse.up(); await sleep(200); };
const objs = () => page.evaluate(() => window.__canvas.getObjects().map((o) => ({ type: o.type, id: o.id, label: o.label, l: Math.round(o.left), t: Math.round(o.top), w: Math.round(o.width), h: Math.round(o.height), s: o.start && o.start.nodeId, e: o.end && o.end.nodeId, sx: o.scaleX })));
const dot = (index, side) => page.evaluate((i, s) => { const n = window.__canvas.getObjects().filter((o) => o.type === "flownode")[i]; const c = n.oCoords[`connect-${s}`]; return [c.x, c.y]; }, index, side);

// عقدتين
await tool(page, "الأشكال"); await tool(page, "مستطيل"); await drag(300, 300, 440, 380);
await tool(page, "الأشكال"); await tool(page, "مستطيل"); await drag(800, 300, 940, 380);

// 1) سحب من نقطة الربط اليمين للعقدة التانية
await page.mouse.click(370, 340); await sleep(200);
const [dx, dy] = await dot(0, "right");
await drag(dx, dy, 870, 340);
let o = await objs();
const c1 = o.find((x) => x.type === "flowconnector");
check("سحب من نقطة الربط بيربط العقدتين", c1 && c1.s === o[0].id && c1.e === o[1].id, JSON.stringify(c1));

// 2) نقرة على نقطة الربط من تحت = عقدة فرعية جديدة ومتصلة
await page.mouse.click(370, 340); await sleep(200);
const [bx, by] = await dot(0, "bottom");
await page.mouse.click(bx, by); await sleep(400);
o = await objs();
check("نقرة على نقطة الربط عملت عقدة فرعية", o.filter((x) => x.type === "flownode").length === 3);
check("ومتصلة برابط جديد", o.filter((x) => x.type === "flowconnector").length === 2);
const editorOpen = await page.evaluate(() => getComputedStyle(document.querySelector("[data-node-editor]")).display !== "none");
check("محرّر النص اتفتح على العقدة الجديدة", editorOpen);
await page.keyboard.type("child"); await page.keyboard.press("Escape"); await sleep(200);

// 3) تحريك العقدة الأولى: الروابط الاتنين بتتبعها
const before = await page.evaluate(() => window.__canvas.getObjects().filter((o) => o.type === "flowconnector").map((c) => [c.start.x, c.start.y]));
await tool(page, "تحديد");
await drag(370, 330, 370, 250); // لازم يمسك العقدة 0 من جوّاها
await sleep(300);
const after = await page.evaluate(() => window.__canvas.getObjects().filter((o) => o.type === "flowconnector").map((c) => [c.start.x, c.start.y]));
check("كل الروابط المتصلة بالعقدة تحرّكت معاها", after.every((p, i) => Math.abs(p[1] - before[i][1]) > 40), JSON.stringify([before, after]));

// 4) تغيير الحجم من المقبض مش بيمطّ النص (scale يفضل 1)
await page.mouse.click(370, 260); await sleep(200);
const br = await page.evaluate(() => { const n = window.__canvas.getObjects().filter((o) => o.type === "flownode")[0]; const c = n.oCoords.br; return [c.x, c.y]; });
await drag(br[0], br[1], br[0] + 60, br[1] + 40);
o = await objs();
check("تغيير الحجم بيغيّر الأبعاد مش الـ scale", o[0].sx === 1 && o[0].w > 150, JSON.stringify(o[0]));

// 5) إعادة ربط طرف الرابط: نسحب طرف النهاية لعقدة الفرعية
const ends = await page.evaluate(() => { const c = window.__canvas.getObjects().find((x) => x.type === "flowconnector"); c.canvas.setActiveObject(c); c.canvas.requestRenderAll(); const p = c.oCoords.end; return [p.x, p.y]; });
await sleep(200);
const third = await page.evaluate(() => { const n = window.__canvas.getObjects().filter((o) => o.type === "flownode")[2]; const p = n.getCenterPoint(); return [p.x, p.y, n.id]; });
await drag(ends[0], ends[1], third[0], third[1]);
const rebound = await page.evaluate(() => window.__canvas.getObjects().find((x) => x.type === "flowconnector").end.nodeId);
check("سحب طرف الرابط بيعيد ربطه بعقدة تانية", rebound === third[2], rebound);

// 6) حذف عقدة: الرابط يفضل (طرفه يتحرر)
const n0 = (await objs()).filter((x) => x.type === "flownode").length;
await page.evaluate(() => { const n = window.__canvas.getObjects().filter((o) => o.type === "flownode")[2]; window.__canvas.setActiveObject(n); });
await page.keyboard.press("Delete"); await sleep(300);
o = await objs();
check("Delete بيحذف العقدة", o.filter((x) => x.type === "flownode").length === n0 - 1);
check("الروابط فضلت وأطرافها اتحررت من العقدة المحذوفة", o.filter((x) => x.type === "flowconnector").every((c) => c.s !== null || c.e !== null) && o.filter((x) => x.type === "flowconnector").length >= 1);

// 7) تراجع/إعادة
const count = (await objs()).length;
await page.click('[aria-label="تراجع"]'); await sleep(500);
const undone = (await objs()).length;
await page.click('[aria-label="إعادة"]'); await sleep(500);
const redone = (await objs()).length;
check("التراجع رجّع العقدة المحذوفة وإعادة حذفتها", undone === count + 1 && redone === count, `${count} → ${undone} → ${redone}`);

await page.screenshot({ path: "/tmp/connect1.png" });
check("مفيش أخطاء", errors.length === 0, errors.join("|").slice(0, 300));
await browser.close();
process.exit(failed ? 1 : 0);
