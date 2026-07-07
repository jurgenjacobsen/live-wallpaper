import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const candidates = [
  path.join(repoRoot, "public", "icon.png"),
  path.join(repoRoot, "go", "assets", "icon.png"),
];

const targets = [
  path.join(repoRoot, "public", "icon.png"),
  path.join(repoRoot, "go", "assets", "icon.png"),
];

async function getMostRecentExistingFile(paths: string[]): Promise<string | null> {
  let newest: { filePath: string; mtimeMs: number } | null = null;

  for (const filePath of paths) {
    try {
      const fileStat = await stat(filePath);
      if (!newest || fileStat.mtimeMs > newest.mtimeMs) {
        newest = { filePath, mtimeMs: fileStat.mtimeMs };
      }
    } catch {
      // Skip missing files.
    }
  }

  return newest?.filePath ?? null;
}

async function main(): Promise<void> {
  const source = await getMostRecentExistingFile(candidates);
  if (!source) {
    throw new Error("No icon source found. Expected public/icon.png or go/assets/icon.png");
  }

  for (const target of targets) {
    const dir = path.dirname(target);
    await mkdir(dir, { recursive: true });
    if (path.resolve(target) === path.resolve(source)) {
      continue;
    }
    await copyFile(source, target);
  }

  const relativeSource = path.relative(repoRoot, source).replaceAll("\\", "/");
  console.log(`[sync-icon] synced icon assets from ${relativeSource}`);
}

main().catch((err) => {
  console.error(`[sync-icon] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
