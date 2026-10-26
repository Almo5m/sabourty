import { launch, newBoard, sleep, stroke, tool, savedCount, objects } from "./lib.mjs";
const { browser, page, errors } = await launch();
await newBoard(page);
await tool(page, "قلم حر");
await stroke(page, 400, 300, 600, 380);
await stroke(page, 400, 450, 650, 420);
await stroke(page, 700, 300, 800, 500);
for (const [l, n] of [["تراجع", 4], ["إعادة", 3]]) for (let i = 0; i < n; i++) { await tool(page, l); await sleep(450); console.log(l, "saved", await savedCount(page), "canvas", await objects(page)); }
console.log(errors);
await browser.close();
