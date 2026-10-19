import assert from "node:assert/strict";
import {access} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";

const root = path.resolve(import.meta.dirname, "..");
const rootModule = path.join(root, "assets", "result-data-v2.js");
const modulePath = await access(rootModule).then(() => rootModule).catch(() => path.join(root, "dist", "assets", "result-data-v2.js"));
const data = await import(pathToFileURL(modulePath));

assert.deepEqual(data.HORMONE_STANDARDS.SA, {initial: 1, min: 0.3, max: 3, unit: "µM"});
assert.deepEqual(data.HORMONE_STANDARDS.ABA, {initial: 0.02, min: 0.005, max: 0.05, unit: "µM"});
assert.deepEqual(data.HORMONE_STANDARDS["JA-Ile"], {initial: 50, min: 10, max: 100, unit: "µM"});

assert.equal(data.classifyConcentration("ABA", 5, "nM").status, "NORMAL");
assert.equal(data.classifyConcentration("ABA", 4.8, "nM").status, "BELOW_RANGE");
assert.equal(data.classifyConcentration("SA", 3.1, "µM").status, "ABOVE_RANGE");
assert.equal(data.classifyConcentration("JA-Ile", 50, "uM").status, "NORMAL");

const rows = data.normalizeRows([
  {run: "TEST", well: "A1", sample: "Plant-01", analyte: "SA", value: 1.0, unit: "uM", qc: "OK", ts: "2026-10-15T08:00:00+08:00"},
  {run: "TEST", well: "A1", sample: "Plant-01", analyte: "SA", value: 1.1, unit: "uM", qc: "OK", ts: "2026-10-16T08:00:00+08:00"},
  {run: "TEST", well: "B1", sample: "Plant-01", analyte: "ABA", value: 20, unit: "nM", qc: "OK", ts: "2026-10-16T08:00:00+08:00"},
  {run: "TEST", well: "C1", sample: "Plant-01", analyte: "JA-Ile", value: 0, unit: "uM", qc: "OK", ts: "2026-10-16T08:00:00+08:00"},
  {run: "TEST", well: "C2", sample: "Plant-02", analyte: "JA-Ile", value: "", unit: "uM", qc: "NO_CAL", signal: 2400, ts: "2026-10-16T08:00:00+08:00"}
]);

assert.equal(rows.length, 5);
assert.equal(data.summarize(rows, "SA").count, 2);
assert.equal(data.summarize(rows, "ABA").mean, 20);
assert.equal(data.recordStatus(rows[3]).code, "BELOW_RANGE");
assert.equal(data.recordStatus(rows[4]).code, "UNCALIBRATED");

const merged = data.mergeRecords(rows.slice(0, 1), rows.slice(1));
assert.equal(merged.length, 5);
assert.equal(data.removeRecord(merged, merged[0]).length, 4);

const series = data.trendSeries(rows, "SA", "Plant-01");
assert.equal(series.points.length, 2);
assert.ok(data.nextStepAdvice(rows, "SA", "Plant-01", "en").text.length > 0);

const csv = data.toCsv(rows);
assert.match(csv, /recorded_at/);
assert.match(csv, /2026-10-15/);
assert.match(csv, /Plant-01/);

console.log("PASS: normalization, ranges, units, trends, merge/delete and CSV export.");
