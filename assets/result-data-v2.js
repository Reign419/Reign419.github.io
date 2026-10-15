// PlantSOS result contract. No calibration or demo conversion is performed here.
export function finiteNumber(value) {
  if (value === null || value === undefined || typeof value === "boolean") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value).trim().replace(/,/g, "");
  if (!text || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}
const keyOf = key => String(key).trim().toLowerCase().replace(/[\s_-]+/g, "");
function fields(input) {
  return new Map(Object.entries(input || {}).map(([key, value]) => [keyOf(key), value]));
}
function pick(map, names) {
  for (const name of names) {
    const value = map.get(keyOf(name));
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return undefined;
}
function pickNumber(map, names) {
  for (const name of names) {
    const number = finiteNumber(map.get(keyOf(name)));
    if (number !== null) return number;
  }
  return null;
}
export function normalizeUnit(value) {
  const text = String(value ?? "").trim();
  if (/^(?:u|µ|μ)m$/i.test(text)) return "µM";
  if (/^nm$/i.test(text)) return "nM";
  if (/^pm$/i.test(text)) return "pM";
  if (text === "mM" || text === "M") return text;
  return text;
}
export function normalizeAnalyte(value) {
  const text = String(value ?? "").trim();
  const key = text.toUpperCase().replace(/[\s_‐‑–—-]/g, "");
  return key === "SA" ? "SA" : key === "ABA" ? "ABA" : key === "JAILE" ? "JA-Ile" : text || "UNKNOWN";
}
export function normalizeWell(value) {
  const text = String(value ?? "").trim().toUpperCase();
  const match = text.match(/^([A-H])0?([1-9]|1[0-2])$/);
  return match ? match[1] + String(Number(match[2])).padStart(2, "0") : text;
}
export function normalizeResult(input, index = 0, source = "file") {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const map = fields(input);
  const type = pick(map, ["type"]);
  if (type && ["status", "heartbeat", "hello", "ack"].includes(String(type).toLowerCase())) return null;
  // A valid firmware value takes precedence over other concentration aliases, including zero.
  const concentration = pickNumber(map, ["value", "concentration", "conc", "浓度", "浓度值"]);
  const signal = pickNumber(map, ["signal", "raw_rlu", "rlu", "intensity", "flu", "荧光", "光强", "采集信号"]);
  if (concentration === null && signal === null) return null;
  const sequence = pick(map, ["seq", "sequence", "序号"]) ?? "";
  const run = String(pick(map, ["run", "实验", "批次"]) ?? "");
  const plate = String(pick(map, ["plate", "孔板"]) ?? "");
  const well = normalizeWell(pick(map, ["well", "position", "孔位"]) ?? "");
  const time = String(pick(map, ["ts", "timepoint", "time", "时间", "receivedAt"]) ?? "");
  return {
    id: String(pick(map, ["id"]) ?? (sequence !== "" ? [run, plate, sequence].join(":") : "row-" + index)),
    sequence, run, plate, well,
    sample: String(pick(map, ["sample", "sample_id", "样本", "样本名", "组别"]) ?? well ?? ""),
    analyte: normalizeAnalyte(pick(map, ["analyte", "hormone", "激素"])),
    signal, concentration,
    unit: normalizeUnit(pick(map, ["unit", "conc_unit", "units", "单位"])),
    qc: String(pick(map, ["qc", "status", "质控"]) ?? (concentration === null ? "NO_CAL" : "NOT_PROVIDED")),
    time, source: String(pick(map, ["source"]) ?? source),
    concentrationSource: concentration === null ? "unavailable" : "provided"
  };
}
export function normalizeRows(rows, source = "file") {
  if (!Array.isArray(rows)) return [];
  const output = [];
  rows.forEach((input, index) => {
    const result = normalizeResult(input, index, source);
    if (result) { output.push(result); return; }
    // A wide table is accepted only when its numeric columns are named actual wells.
    if (!input || typeof input !== "object") return;
    for (const [well, value] of Object.entries(input)) {
      if (!/^([A-H])0?([1-9]|1[0-2])$/i.test(well) || finiteNumber(value) === null) continue;
      output.push(normalizeResult({well, signal: value, sample: well}, index + "-" + well, source));
    }
  });
  return output;
}
const MOLAR = {"M": 1, "mM": 1e-3, "µM": 1e-6, "nM": 1e-9, "pM": 1e-12};
export function summarize(records, analyte) {
  const rows = records.filter(row => normalizeAnalyte(row.analyte) === normalizeAnalyte(analyte));
  const target = rows.find(row => finiteNumber(row.concentration) !== null && normalizeUnit(row.unit));
  const unit = normalizeUnit(target?.unit);
  const values = [];
  let excluded = 0, alerts = 0;
  for (const row of rows) {
    const value = finiteNumber(row.concentration), sourceUnit = normalizeUnit(row.unit);
    if (String(row.qc).toUpperCase() !== "OK" || value === null) alerts++;
    if (value === null || !unit || !sourceUnit) { excluded++; continue; }
    if (sourceUnit === unit) values.push(value);
    else if (MOLAR[sourceUnit] && MOLAR[unit]) values.push(value * MOLAR[sourceUnit] / MOLAR[unit]);
    else excluded++;
  }
  return {analyte, rows, count: values.length, unit,
    mean: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
    max: values.length ? Math.max(...values) : null, excluded, alerts};
}
export function convertConcentration(row, unit) {
  const value = finiteNumber(row?.concentration), from = normalizeUnit(row?.unit), to = normalizeUnit(unit);
  if (value === null || !from || !to) return null;
  return from === to ? value : MOLAR[from] && MOLAR[to] ? value * MOLAR[from] / MOLAR[to] : null;
}
export function formatNumber(value) {
  const number = finiteNumber(value);
  return number === null ? "—" : Number(number.toPrecision(6)).toString();
}
export function concentrationText(row, locale) {
  if (row.concentration === null) return locale === "zh" ? "待标定" : "Uncalibrated";
  return formatNumber(row.concentration);
}
export function qcText(row, locale) {
  if (row.concentration === null && String(row.qc).toUpperCase() === "OK") return locale === "zh" ? "OK · 待标定" : "OK · Uncalibrated";
  const known = {
    OK: ["通过", "Pass"],
    LOW: ["偏低", "Low"],
    HIGH: ["偏高", "High"],
    ABOVE_RANGE: ["超出范围", "Above range"],
    BELOW_RANGE: ["低于范围", "Below range"],
    SATURATED: ["信号饱和", "Saturated"],
    NO_CAL: ["待标定", "Uncalibrated"],
    NOT_PROVIDED: ["未提供", "Not provided"]
  };
  return known[String(row.qc).toUpperCase()]?.[locale === "zh" ? 0 : 1] ?? row.qc;
}
export function toCsv(records) {
  const headers = ["v","type","run","plate","well","sample","analyte","value","unit","qc","signal","ts","seq"];
  const quote = value => '"' + String(value ?? "").replace(/"/g, '""') + '"';
  return "\ufeff" + headers.join(",") + "\r\n" + records.map(row => {
    const data = {v:1, type:"result", ...row, value:row.concentration, ts:row.time, seq:row.sequence};
    return headers.map(key => quote(data[key])).join(",");
  }).join("\r\n") + "\r\n";
}
export function parseJsonResults(text) {
  const trimmed = String(text).replace(/^\ufeff/, "").trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) return JSON.parse(trimmed);
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed.results) ? parsed.results : [parsed];
  } catch {
    return trimmed.split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line));
  }
}
