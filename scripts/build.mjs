import {access, cp, mkdir, rm} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootIndex = path.join(root, "index.html");
const fallbackIndex = path.join(root, "dist", "index.html");

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

const source = await exists(rootIndex) ? root : path.join(root, "dist");
if (!(await exists(path.join(source, "index.html")))) {
  throw new Error(`No deployable index.html found at ${rootIndex} or ${fallbackIndex}`);
}

const output = path.join(root, "build");
await rm(output, {recursive: true, force: true});
await mkdir(output, {recursive: true});

const required = [
  "index.html",
  "sw.js",
  "ble-results-v2.js",
  "phase1-results-v2.js",
  "ble.css",
  "wifi.css",
  "phase1.css",
  "assets"
];

const optional = [
  "manifest.webmanifest",
  "icon-192.png",
  "icon-512.png",
  "cuhksz-igem-logo.png",
  "favicon.svg",
  ".nojekyll",
  "_headers"
];

for (const entry of required) {
  const from = path.join(source, entry);
  if (!(await exists(from))) throw new Error(`Required site asset is missing: ${entry}`);
  await cp(from, path.join(output, entry), {recursive: true});
}

const omitted = [];
for (const entry of optional) {
  const from = path.join(source, entry);
  if (await exists(from)) await cp(from, path.join(output, entry), {recursive: true});
  else omitted.push(entry);
}

console.log(`Built PlantSOS from ${path.relative(root, source) || "."} into build/`);
if (omitted.length) console.warn(`Optional branding/PWA files not present in this checkout: ${omitted.join(", ")}`);
