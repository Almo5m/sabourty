// أدوات مساعدة للاختبارات الآلية
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

export const BASE = process.env.BASE_URL ?? "http://localhost:3100";
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch() {
  const browser = await puppeteer.launch({
    args: [
      ...chromium.args,
      "--no-sandbox",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
    ],
    executablePath: process.env.CHROME_PATH ?? (await chromium.executablePath()),
    headless: "shell",
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, hasTouch: true });
  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
  page.on("dialog", (d) => d.accept());
  const cdp = await page.createCDPSession();
  const touch = (type, pts) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: pts.map(([x, y], id) => ({ x, y, id })),
    });
  return { browser, page, errors, touch };
}

export async function clickByText(page, selector, text) {
  for (const el of await page.$$(selector)) {
    const t = await el.evaluate((n) => n.textContent.trim());
    if (t.includes(text)) { await el.click(); return true; }
  }
  return false;
}

export async function newBoard(page) {
  await page.goto(BASE, { waitUntil: "networkidle0" });
  await clickByText(page, "button", "لوحة جديدة");
  await page.waitForSelector("canvas");
  await sleep(800);
}

export const objects = (page) => page.evaluate(() => window.__canvas.getObjects().length);
export const panelCount = (page) =>
  page.evaluate(() => {
    const h = [...document.querySelectorAll("h2")].find((e) => e.textContent.includes("الطبقات"));
    return parseInt(h?.parentElement.querySelector("span.ms-auto")?.textContent ?? "-1");
  });
export const savedCount = (page) =>
  page.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => x.startsWith("sabourty:board:"));
    const b = JSON.parse(localStorage.getItem(k));
    return b.canvasJSON ? b.canvasJSON.objects.length : 0;
  });

export async function stroke(page, x1, y1, x2, y2) {
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++)
    await page.mouse.move(x1 + ((x2 - x1) * i) / 12, y1 + ((y2 - y1) * i) / 12);
  await page.mouse.up();
  await sleep(150);
}

export const tool = (page, label) => page.click(`[aria-label="${label}"]`);
