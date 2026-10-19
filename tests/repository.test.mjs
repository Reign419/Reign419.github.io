import assert from "node:assert/strict";
import {access, readFile} from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
for (const file of ["README.md", "LICENSE", "NOTICE", "package.json", "package-lock.json"]) {
  await access(path.join(root, file));
}

const source = await access(path.join(root, "index.html")).then(() => root).catch(() => path.join(root, "dist"));
for (const file of [
  "index.html",
  "sw.js",
  "ble-results-v2.js",
  "phase1-results-v2.js",
  "assets/result-data-v2.js",
  "assets/result-ui-v2.js",
  "assets/page-results-v2.js"
]) {
  await access(path.join(source, file));
}

const readme = await readFile(path.join(root, "README.md"), "utf8");
for (const section of ["Installation", "Run locally", "Reproduce the main results", "License", "AI disclosure", "Known limitations"]) {
  assert.match(readme, new RegExp(`## ${section}`));
}
assert.match(await readFile(path.join(root, "LICENSE"), "utf8"), /Apache License\s+Version 2\.0/);
console.log("PASS: repository contains the required documentation, license, lockfile and runtime source.");
