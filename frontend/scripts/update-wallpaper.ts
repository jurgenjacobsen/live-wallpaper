/**
 * update-wallpaper.ts
 *
 * Launches a headless Chromium browser via Puppeteer, navigates to the local
 * React dev server, waits for the page to fully load (including custom fonts),
 * takes a 1920×1080 screenshot, saves it as wallpaper.png, and sets it as the
 * OS desktop background using the `wallpaper` npm package.
 *
 * Usage:
 *   npx tsx scripts/update-wallpaper.ts
 */

import path from "path";
import { fileURLToPath } from "url";
import puppeteer, { type Page } from "puppeteer";
import { setWallpaper } from "wallpaper";
import * as dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL ?? "http://localhost:5173";
const OUTPUT_PATH = path.resolve(__dirname, "../wallpaper.png");

async function waitForFonts(page: Page): Promise<void> {
  await page.evaluate(() =>
    (document as Document & { fonts: FontFaceSet }).fonts.ready
  );
}

export async function captureWallpaper(url = DEV_SERVER_URL, outputPath = OUTPUT_PATH): Promise<string> {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--window-size=1920,1080",
    ],
  });

  let page: Page | undefined;
  try {
    page = await browser.newPage();

    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

    console.log(`[update-wallpaper] Navigating to ${url} …`);
    await page.goto(url, { waitUntil: "networkidle0", timeout: 60_000 });

    // Wait for custom fonts to finish loading
    await waitForFonts(page);

    console.log(`[update-wallpaper] Taking screenshot → ${outputPath}`);
    await page.screenshot({ path: outputPath, type: "png" });

    return outputPath;
  } finally {
    await page?.close();
    await browser.close();
  }
}

async function main(): Promise<void> {
  try {
    const saved = await captureWallpaper();
    console.log(`[update-wallpaper] Setting wallpaper from ${saved} …`);
    await setWallpaper(saved);
    console.log("[update-wallpaper] ✓ Wallpaper updated successfully.");
  } catch (err) {
    console.error("[update-wallpaper] ✗ Failed:", err);
    process.exit(1);
  }
}

// Run when invoked directly (not when imported by the scheduler)
const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  void main();
}
