import assert from "node:assert/strict";
import {access, readFile} from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = file => readFile(path.join(root, file), "utf8");

const bootstrap = await read("assets/bootstrap-results-v2.js");
assert.match(bootstrap, /\.createRoot\(/);
assert.doesNotMatch(bootstrap, /hydrateRoot/);

const html = await read("index.html");
assert.match(html, /<div id="plantsos-root"><\/div>/);
assert.doesNotMatch(html, /<div id="plantsos-root"><main/);

const page = await read("assets/page-results-v2.js");
assert.match(page, /slice\(-4\)\.reverse\(\)/);
assert.match(page, /PSInitialLanguage/);
assert.match(page, /PlantSOS Hormone Analyzer/);

const ble = await read("ble-results-v2.js");
assert.match(ble, /PSData\.qcText\(result,language\(\)\)/);

const manifest = JSON.parse(await read("manifest.webmanifest"));
assert.equal(manifest.lang, "en");
assert.doesNotMatch(manifest.name, /[\u3400-\u9fff]/);

for (const file of [
  "Reign419.github.io-main-fixed.zip",
  "phase1.js",
  "index.rsc",
  "file.svg",
  "globe.svg",
  "window.svg"
]) {
  await assert.rejects(access(path.join(root, file)));
}

console.log("PASS: startup, locale, recent records, BLE QC and cleanup checks.");
