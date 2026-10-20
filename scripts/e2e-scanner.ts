/* Drives the real scanner page in system Chromium: online check-in, offline queue, resync.
 * Usage: tsx scripts/e2e-scanner.ts <cookieFile> <eventId> <code1> <code2> */
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const [cookieFile, eventId, code1, code2] = process.argv.slice(2);
const base = "http://localhost:3100";

function cookiesFromNetscape(file: string) {
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l && (!l.startsWith("#") || l.startsWith("#HttpOnly_")))
    .map((l) => l.replace(/^#HttpOnly_/, "").split("\t"))
    .filter((p) => p.length >= 7)
    .map((p) => ({ name: p[5], value: p[6], domain: "localhost", path: p[2], httpOnly: true }));
}

(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true });
  const ctx = await browser.newContext({ viewport: { width: 420, height: 860 } });
  await ctx.addCookies(cookiesFromNetscape(cookieFile));
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") console.log("[console.error]", m.text()); });
  await page.goto(`${base}/admin/scan/${eventId}`);
  await page.getByText(/Ticket list/).waitFor({ timeout: 15000 });
  const stat = async (label: string) => Number(await page.locator(`div:has(> div:text-is("${label}")) > div`).first().innerText());
  console.log("loaded. checked in:", await stat("Checked in"), "issued:", await stat("Issued"));

  // 1. online manual code check-in
  await page.getByRole("button", { name: "Type code" }).click();
  await page.getByPlaceholder("BBC-7K3M-PX2Q").fill(code1);
  await page.getByRole("button", { name: "Check in" }).click();
  await page.getByText("Welcome in").waitFor({ timeout: 5000 });
  console.log("online scan ->", "Welcome in");
  await page.getByText("tap to continue").click();
  await page.waitForTimeout(1500);
  console.log("pending sync after online scan:", await stat("Pending sync"));

  // 2. duplicate on same device
  await page.getByPlaceholder("BBC-7K3M-PX2Q").fill(code1);
  await page.getByRole("button", { name: "Check in" }).click();
  await page.getByText("Already scanned").waitFor({ timeout: 5000 });
  console.log("re-scan ->", "Already scanned");
  await page.getByText("tap to continue").click();

  // 3. offline scan gets queued
  await ctx.setOffline(true);
  await page.waitForTimeout(500);
  await page.getByText(/Offline/).waitFor({ timeout: 5000 });
  await page.getByPlaceholder("BBC-7K3M-PX2Q").fill(code2);
  await page.getByRole("button", { name: "Check in" }).click();
  await page.getByText("Welcome in").waitFor({ timeout: 5000 });
  await page.getByText("tap to continue").click();
  await page.waitForTimeout(500);
  const pendingOffline = await stat("Pending sync");
  console.log("offline scan -> Welcome in, pending sync:", pendingOffline);

  // 4. invalid code offline
  await page.getByPlaceholder("BBC-7K3M-PX2Q").fill("BBC-0000-0000");
  await page.getByRole("button", { name: "Check in" }).click();
  await page.getByText("Invalid ticket").waitFor({ timeout: 5000 });
  console.log("bogus code -> Invalid ticket");
  await page.getByText("tap to continue").click();

  // 5. back online -> queue drains
  await ctx.setOffline(false);
  await page.waitForFunction(() => {
    const els = [...document.querySelectorAll("div")].filter((d) => d.textContent?.trim() === "Pending sync");
    const v = els[0]?.previousElementSibling?.textContent;
    return v === "0";
  }, null, { timeout: 15000 });
  console.log("back online -> pending sync:", await stat("Pending sync"), "checked in:", await stat("Checked in"));

  // 6. reload offline: page served by service worker cache
  await page.waitForTimeout(1500);
  await ctx.setOffline(true);
  const res = await page.reload({ waitUntil: "domcontentloaded" }).catch((e) => e);
  const okOffline = res && !(res instanceof Error) ? await page.getByText(/Ticket list|Door scanner|Checked in/).first().isVisible().catch(() => false) : false;
  console.log("offline reload served from cache:", okOffline);
  await page.screenshot({ path: process.env.SHOT ?? "/tmp/scanner.png" });
  await browser.close();
})().catch((e) => { console.error("E2E FAILED:", e.message); process.exit(1); });
