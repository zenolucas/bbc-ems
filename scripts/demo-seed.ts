/*
 * Demo deployment database tool. Reads .env.local, then .env.demo (DEMO_MODE=1 and the
 * demo DATABASE_URL) over it; variables you export yourself win over both.
 *
 *   pnpm demo:seed --init --yes   mark an empty database as the demo one and seed it
 *   pnpm demo:seed --reset        wipe the demo data back to the story (same as the admin button)
 *   pnpm demo:seed switch on|off  the /admin/demo switch, for when nobody can reach it
 *
 * Tickets are signed with the signing key in your environment. Run --reset from the
 * deployment's /admin/demo page instead if your local key differs from the deployment's.
 */
import { setDemoSetting } from "../src/lib/demo/flag";
import { initDemoDatabase, resetDemo } from "../src/lib/demo/seed";

async function main() {
  const args = process.argv.slice(2);
  const host = (() => {
    try {
      return new URL(process.env.DATABASE_URL ?? "").host;
    } catch {
      return "(no DATABASE_URL)";
    }
  })();
  console.log(`database: ${host}`);
  if (args[0] === "switch") {
    const on = args[1] === "on";
    if (!["on", "off"].includes(args[1] ?? "")) throw new Error("switch on|off");
    await setDemoSetting("enabled", on);
    console.log(`demo mode ${on ? "on" : "off"}`);
  } else if (args.includes("--init")) {
    if (!args.includes("--yes")) throw new Error(`This marks ${host} as a demo database and wipes its events. Re-run with --yes.`);
    console.log("seeded", await initDemoDatabase());
  } else if (args.includes("--reset")) {
    console.log("reset", await resetDemo());
  } else {
    console.log("usage: pnpm demo:seed --init --yes | --reset | switch on|off");
  }
  process.exit(0);
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
