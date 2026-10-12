import env from "@next/env";
import { runBookingMaintenance } from "../lib/bookings.js";

env.loadEnvConfig(process.cwd());

const intervalSeconds = Math.max(10, Number(process.env.CRON_INTERVAL_SECONDS) || 60);
const once = process.argv.includes("--once");

console.log(`[The HauS 26] Booking maintenance runner started.`);
console.log(`Mode: ${once ? "Single run (--once)" : `Continuous loop (every ${intervalSeconds}s)`}`);

async function tick() {
  const timestamp = new Date().toLocaleTimeString("en-US", { hour12: false });
  try {
    const result = await runBookingMaintenance();
    if (result.released > 0 || result.checked > 0) {
      console.log(`[${timestamp}] Holds maintenance: checked=${result.checked}, released=${result.released}, retained=${result.retained}`);
    } else {
      process.stdout.write(`.`);
    }
  } catch (error) {
    console.error(`\n[${timestamp}] Error during hold maintenance:`, error?.message || error);
  }
}

await tick();

if (!once) {
  setInterval(tick, intervalSeconds * 1000);
}
