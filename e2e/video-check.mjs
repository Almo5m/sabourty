// يسجّل فيديو حي + إعادة تشغيل على كروم حقيقي ويحفظهم في /tmp للفحص (يحتاج ffmpeg).
import { launch, sleep, newBoard, tool, clickByText, stroke, saveVideo } from "./lib.mjs";
const { browser, page, errors } = await launch();
await newBoard(page);
await tool(page, "قلم حر");
await stroke(page, 400, 300, 600, 380);
await tool(page, "تصدير فيديو"); await sleep(300);
await clickByText(page, "button", "ابدأ التسجيل المباشر"); await sleep(1200);
// رسم بطيء أثناء التسجيل (علشان نشوف الخط وهو بيتكوّن)
for (let k = 0; k < 3; k++) {
  const y = 450 + k * 70;
  await page.mouse.move(400, y); await page.mouse.down();
  for (let i = 1; i <= 40; i++) { await page.mouse.move(400 + i * 7, y + Math.sin(i / 4) * 25); await sleep(40); }
  await page.mouse.up(); await sleep(300);
}
await clickByText(page, "button", "إيقاف"); await sleep(2000);
await saveVideo(page, "/tmp/live.webm");
await clickByText(page, "button", "تجاهل"); await sleep(300);
await clickByText(page, "button", "×2"); await clickByText(page, "button", "ابدأ إعادة التشغيل والتسجيل");
await page.waitForFunction(() => !!document.querySelector("video"), { timeout: 90000 });
await saveVideo(page, "/tmp/replay.webm");
console.log("errors:", errors);
await browser.close();
