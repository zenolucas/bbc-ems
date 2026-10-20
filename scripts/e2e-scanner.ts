/* Drives the real scanner page in system Chromium against the dev server and checks the
 * scan loop end to end: online check-in, duplicates, offline queue, resync, conflicts, cached reload.
 * Picks unused tickets for the event straight from the database.
 *
 * Usage: pnpm e2e:scanner <cookies.txt | magic-link-url> <eventId>
 */
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { chromium } from "playwright-core";

const [auth, eventId] = process.argv.slice(2);
const base = process.env.E2E_BASE ?? "http://localhost:3100";
if (!auth || !eventId) throw new Error("usage: e2e-scanner <cookies.txt | magic-link-url> <eventId>");

let failures = 0;
const check = (label: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${extra ? ` (${extra})` : ""}`);
  if (!ok) failures++;
};

function cookiesFromNetscape(file: string) {
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l && (!l.startsWith("#") || l.startsWith("#HttpOnly_")))
    .map((l) => l.replace(/^#HttpOnly_/, "").split("\t"))
    .filter((p) => p.length >= 7)
    .map((p) => ({ name: p[5], value: p[6], domain: "localhost", path: p[2], httpOnly: true }));
}

(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const ticketStatus = async (code: string) => (await db.query("select status from tickets where short_code = $1", [code])).rows[0]?.status as string;
  const { rows } = await db.query("select short_code from tickets where event_id = $1 and status = 'valid' order by created_at desc limit 6", [eventId]);
  if (rows.length < 6) throw new Error(`need 6 unused tickets for ${eventId}, found ${rows.length}`);
  const [c1, c2, c3, c4, c5, c6] = rows.map((r) => r.short_code as string);

  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true });
  const ctx = await browser.newContext({ viewport: { width: 420, height: 860 } });
  const page = await ctx.newPage();
  if (auth.startsWith("http")) await page.goto(auth);
  else await ctx.addCookies(cookiesFromNetscape(auth));
  page.on("pageerror", (e) => console.log("[pageerror]", e.message.slice(0, 300)));

  await page.goto(`${base}/admin/scan/${eventId}`);
  await page.getByText(/Ticket list (just updated|updated)/).waitFor({ timeout: 15000 });
  const stat = async (label: string) => Number(await page.locator(`div:has(> div:text-is("${label}")) > div`).first().innerText());
  const waitStat = (label: string, v: number) =>
    page.waitForFunction(([l, want]) => {
      const el = [...document.querySelectorAll("div")].find((d) => d.textContent?.trim() === l);
      return el?.previousElementSibling?.textContent === String(want);
    }, [label, v] as const, { timeout: 15000 }).then(() => true, () => false);
  const typeCode = async (code: string) => {
    await page.getByPlaceholder("BBC-7K3M-PX2Q").fill(code);
    await page.getByRole("button", { name: "Check in" }).click();
  };
  const result = async (text: string) => page.getByRole("alertdialog", { name: text }).waitFor({ timeout: 5000 }).then(() => true, () => false);
  const dismiss = () => page.getByRole("button", { name: /Tap anywhere to continue/ }).click();

  await page.getByRole("tab", { name: "Type code" }).click();

  // 1. online check-in and same-device duplicate
  await typeCode(c1);
  check("online check-in -> Welcome in", await result("Welcome in"));
  await dismiss();
  check("synced to server", await waitStat("To sync", 0));
  check("server marks it used", (await ticketStatus(c1)) === "used");
  await typeCode(c1);
  check("re-scan -> Already scanned", await result("Already scanned"));
  await dismiss();

  // 2. two quick scans while online: overlapping syncs must not drop either
  await typeCode(c2);
  await dismiss().catch(() => {});
  await typeCode(c3);
  await dismiss().catch(() => {});
  check("rapid scans all sync", await waitStat("To sync", 0));
  check("both reached the server", (await ticketStatus(c2)) === "used" && (await ticketStatus(c3)) === "used");

  // 3. offline: queue, invalid code, conflict with a ticket voided after the list downloaded
  await ctx.setOffline(true);
  await page.getByText(/Offline/).first().waitFor({ timeout: 5000 }).catch(() => {});
  await typeCode(c4);
  check("offline scan -> Welcome in", await result("Welcome in"));
  await dismiss();
  check("offline scan queued", (await stat("To sync")) >= 1);
  await typeCode("BBC-0000-0000");
  check("unknown code -> Invalid ticket", await result("Invalid ticket"));
  await dismiss();
  await db.query("update tickets set status = 'void' where short_code = $1", [c5]); // organiser voids after download
  await typeCode(c5);
  check("voided-after-download admitted from stale list", await result("Welcome in"));
  await dismiss();

  // 4. a ticket the door turns away must never be admitted by the sync
  await db.query("update tickets set status = 'valid', checked_in_at = null where short_code = $1", [c1]); // admin "undo" on another device
  await typeCode(c1);
  check("offline re-scan of locally used ticket -> Already scanned", await result("Already scanned"));
  await dismiss();

  // 5. back online: queue drains and the conflict is surfaced
  await ctx.setOffline(false);
  check("back online -> queue drains", await waitStat("To sync", 0));
  check("void conflict shown", await page.getByText(/had voided that ticket/).first().waitFor({ timeout: 8000 }).then(() => true, () => false));
  check("locally rejected scan did not admit", (await ticketStatus(c1)) === "valid", await ticketStatus(c1));
  check("voided ticket stays void", (await ticketStatus(c5)) === "void");
  check("offline scan reached server", (await ticketStatus(c4)) === "used");

  // 6. after the list refreshes, the undone ticket scans as valid again
  await page.getByRole("button", { name: "Refresh" }).click();
  await page.getByText("Ticket list updated").waitFor({ timeout: 8000 }).catch(() => {});
  await typeCode(c1);
  check("undone ticket valid again after refresh", await result("Welcome in"));
  await dismiss();
  check("recent scans list", await page.getByText("Recent scans on this phone").isVisible());

  // 7. reload offline: shell from the service worker, list from IndexedDB
  await waitStat("To sync", 0);
  await page.waitForTimeout(1500);
  await ctx.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
  const okOffline = await page.getByText(/Checked in/).first().waitFor({ timeout: 10000 }).then(() => true, () => false);
  check("offline reload served from cache", okOffline);
  check("cached list available offline", await page.waitForFunction(() => {
    const el = [...document.querySelectorAll("div")].find((d) => d.textContent?.trim() === "Tickets");
    return Number(el?.previousElementSibling?.textContent) > 0;
  }, null, { timeout: 10000 }).then(() => true, () => false));
  await page.getByRole("tab", { name: "Type code" }).click().catch(() => {});
  await typeCode(c6);
  check("offline scan after offline reload", await result("Welcome in"));
  await dismiss();
  await ctx.setOffline(false);
  await page.reload();
  check("final queue drains", await waitStat("To sync", 0));

  await page.screenshot({ path: process.env.SHOT ?? "/tmp/scanner.png" });
  // put the void test ticket back
  await db.query("update tickets set status = 'valid' where short_code = $1", [c5]);
  await browser.close();
  await db.end();
  console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error("E2E FAILED:", e.message); process.exit(1); });
