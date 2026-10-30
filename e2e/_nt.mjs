import { launch, sleep } from "./lib.mjs";
const { browser, page } = await launch();
const logs = []; page.on("console", (m) => logs.push(m.text().slice(0, 200))); page.on("pageerror", (e) => logs.push("ERR " + e.message.slice(0, 300)));
await page.setViewport({ width: 1120, height: 740 });
await page.goto("http://localhost:3100/nodetest", { waitUntil: "networkidle0" });
await sleep(1500);
await page.screenshot({ path: "/tmp/nodetest.png" });
console.log(logs.filter(l => !l.includes("font") ).slice(0, 8));
await browser.close();
