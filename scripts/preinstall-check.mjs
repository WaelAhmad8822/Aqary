import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";

const userAgent = process.env.npm_config_user_agent ?? "";

if (!userAgent.startsWith("pnpm/")) {
  console.error("Use pnpm instead");
  process.exit(1);
}

const rootDir = path.resolve(import.meta.dirname, "..");
const npmLock = path.join(rootDir, "package-lock.json");
const yarnLock = path.join(rootDir, "yarn.lock");

if (existsSync(npmLock)) {
  await rm(npmLock, { force: true });
}

if (existsSync(yarnLock)) {
  await rm(yarnLock, { force: true });
}
