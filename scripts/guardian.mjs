#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const failures = [];

function fail(message) {
  failures.push(message);
}

const fileCache = new Map();

function read(path) {
  if (!fileCache.has(path)) {
    fileCache.set(path, readFileSync(path, "utf8"));
  }
  return fileCache.get(path);
}

function requireFile(path) {
  if (!existsSync(path)) fail(`${path} is required`);
}

[
  ".github/CODEOWNERS",
  ".github/workflows/guardian.yml",
  "CODE_OF_CONDUCT.md",
  "CONTRIBUTING.md",
  "GOVERNANCE.md",
  "LICENSE",
  "PULL_REQUEST_TEMPLATE.md",
  "README.md",
  "SECURITY.md",
  "SUPPORT.md",
  "profile/README.md",
  "profile/mavula_branding.png",
].forEach(requireFile);

for (const [path, pattern] of [
  ["profile/README.md", /mavulahq\/finance-platform/],
  ["profile/README.md", /mavula\.io/],
  ["profile/README.md", /mavula\.dev/],
  ["profile/README.md", /security@mavula\.io/],
  ["profile/README.md", /legal@mavula\.io/],
]) {
  if (!pattern.test(read(path))) fail(`${path} is missing ${pattern}`);
}

const tracked = spawnSync("git", ["ls-files"], { encoding: "utf8" });
if (tracked.status !== 0) fail("git ls-files failed");
for (const file of tracked.stdout.split("\n").filter(Boolean)) {
  if (/(^|\/)\.env($|\.(?!example$))/.test(file)) fail(`${file} must not be tracked`);
  if (file === "scripts/guardian.mjs") continue;
  if (/\.(png|jpg|jpeg|webp|gif)$/i.test(file)) continue;
  if (/getfluxo-io|@getfluxo|mavula-io|packages\/fengine|packages\/fwk|packages\/fpay|packages\/finfra/.test(read(file))) {
    fail(`${file} contains legacy public identifiers`);
  }
}

if (failures.length > 0) {
  console.error("MAVULA organization profile guardian failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("MAVULA organization profile guardian passed.");
