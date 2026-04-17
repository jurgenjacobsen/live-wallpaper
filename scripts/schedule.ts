/**
 * schedule.ts
 *
 * Runs the wallpaper-capture script on a cron schedule (every 30 minutes).
 * Start this process alongside `npm run dev` to keep the wallpaper current.
 *
 * Usage:
 *   npx tsx scripts/schedule.ts
 */

import cron from "node-cron";
import path from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";
import { captureWallpaper } from "./update-wallpaper.js";
import { setWallpaper } from "wallpaper";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function runUpdate(): Promise<void> {
  console.log(`[scheduler] Running wallpaper update at ${new Date().toISOString()}`);
  try {
    const saved = await captureWallpaper();
    await setWallpaper(saved);
    console.log("[scheduler] ✓ Wallpaper updated.");
  } catch (err) {
    console.error("[scheduler] ✗ Update failed:", err);
  }
}

// Run immediately on startup, then on schedule
void runUpdate();

// Every 30 minutes: "*/30 * * * *"
const task = cron.schedule("*/30 * * * *", () => {
  void runUpdate();
});

console.log("[scheduler] Wallpaper scheduler started - updates every 30 minutes.");
console.log("[scheduler] Press Ctrl+C to stop.");

process.on("SIGINT", () => {
  task.stop();
  console.log("\n[scheduler] Stopped.");
  process.exit(0);
});

process.on("SIGTERM", () => {
  task.stop();
  process.exit(0);
});
