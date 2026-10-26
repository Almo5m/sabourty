// لوحة PDF بالشكل القديم (صورة الصفحة جوه localStorage) لازم تتفتح وتتنقل لـ IndexedDB
import { launch, newBoard, sleep } from "./lib.mjs";
const { browser, page, errors } = await launch();
await newBoard(page);
const id = await page.evaluate(() => location.pathname.split("/").pop());
await page.evaluate((id) => {
  const c = document.createElement("canvas");
  c.width = 300; c.height = 420;
  const x = c.getContext("2d");
  x.fillStyle = "#fff"; x.fillRect(0, 0, 300, 420);
  x.fillStyle = "#c8432f"; x.fillRect(20, 20, 260, 60);
  const key = "sabourty:board:" + id;
  const b = JSON.parse(localStorage.getItem(key));
  b.mode = "pdf"; b.currentPageIndex = 0;
  b.pdfPages = [{ width: 595, height: 842, json: null, backgroundDataUrl: c.toDataURL("image/jpeg", 0.8) }];
  localStorage.setItem(key, JSON.stringify(b));
}, id);
await page.reload({ waitUntil: "networkidle0" });
await sleep(2500);
const r = await page.evaluate((id) => {
  const raw = localStorage.getItem("sabourty:board:" + id);
  const cv = window.__canvas;
  return { stripped: !raw.includes("data:image"), bg: Boolean(cv.backgroundImage), zoom: cv.getZoom() };
}, id);
console.log(JSON.stringify(r), errors);
const ok = r.stripped && r.bg && r.zoom > 0.5 && errors.length === 0;
console.log(ok ? "PASS migration" : "FAIL migration");
await browser.close();
process.exit(ok ? 0 : 1);
