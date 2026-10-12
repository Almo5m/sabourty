import { launch, sleep, newBoard, tool, clickByText } from "./lib.mjs";
const { browser, page } = await launch();
for (const [name, label] of [["mindmap", "خريطة ذهنية"], ["orgchart", "مخطط تنظيمي"], ["fishbone", "أسباب ونتائج"]]) {
  await newBoard(page);
  await tool(page, "القوالب"); await sleep(300);
  await clickByText(page, "button", label); await sleep(700);
  await page.screenshot({ path: `/tmp/shot-${name}.png` });
}
await browser.close();
