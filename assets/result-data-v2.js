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
function calibrationR2(points, predict) {
  const mean = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const sst = points.reduce((sum, point) => sum + (point.y - mean) ** 2, 0);
  const sse = points.reduce((sum, point) => sum + (point.y - predict(point.x)) ** 2, 0);
  return {sse, r2: sst === 0 ? (sse < 1e-12 ? 1 : 0) : 1 - sse / sst};
}
function linearCalibration(points) {
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const denominator = points.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0);
  const slope = denominator === 0 ? 0 : points.reduce((sum, point) => sum + (point.x - meanX) * (point.y - meanY), 0) / denominator;
  const intercept = meanY - slope * meanX;
  const predict = x => intercept + slope * x;
  return {model:"linear", slope, intercept, predict, ...calibrationR2(points, predict)};
}
export function fitCalibration(input) {
  const points = (input || []).map(point => ({x:finiteNumber(point.x), y:finiteNumber(point.y)}))
    .filter(point => point.x !== null && point.y !== null).sort((a,b)=>a.x-b.x);
  if (points.length < 2 || new Set(points.map(point=>point.x)).size < 2) return null;
  const linear = linearCalibration(points);
  const positives = points.filter(point=>point.x>0);
  if (points.length < 5 || new Set(positives.map(point=>point.x)).size < 4) return linear;
  const minimumPositive = Math.min(...positives.map(point=>point.x));
  const prepared = points.map(point=>({...point,z:Math.log(point.x>0?point.x:minimumPositive/10)}));
  const zs=prepared.map(point=>point.z), ys=prepared.map(point=>point.y);
  const minZ=Math.min(...zs),maxZ=Math.max(...zs),zRange=maxZ-minZ||1;
  const minY=Math.min(...ys),maxY=Math.max(...ys),yRange=maxY-minY||1;
  const edge=Math.max(1,Math.floor(prepared.length/4));
  const lowMean=prepared.slice(0,edge).reduce((sum,p)=>sum+p.y,0)/edge;
  const highMean=prepared.slice(-edge).reduce((sum,p)=>sum+p.y,0)/edge;
  const evaluate=params=>{
    const [base,delta,mid,logSlope]=params,slope=Math.exp(logSlope);
    const predictZ=z=>base+delta/(1+Math.exp(-slope*(z-mid)));
    return prepared.reduce((sum,p)=>sum+(p.y-predictZ(p.z))**2,0);
  };
  let best=null;
  for(const midFraction of [.25,.5,.75])for(const slopeSeed of [.5,1,2,4]){
    let params=[lowMean,highMean-lowMean,minZ+zRange*midFraction,Math.log(slopeSeed)];
    let score=evaluate(params),steps=[yRange*.35,yRange*.35,zRange*.2,.45];
    for(let round=0;round<160;round++){
      let improved=false;
      for(let index=0;index<4;index++)for(const direction of [-1,1]){
        const candidate=params.slice();candidate[index]+=steps[index]*direction;
        candidate[2]=Math.max(minZ-zRange,Math.min(maxZ+zRange,candidate[2]));
        candidate[3]=Math.max(-4,Math.min(4,candidate[3]));
        const next=evaluate(candidate);
        if(next<score){params=candidate;score=next;improved=true;}
      }
      if(!improved)steps=steps.map(step=>step*.72);
      if(Math.max(...steps)<1e-8)break;
    }
    if(!best||score<best.score)best={params,score};
  }
  const [base,delta,mid,logSlope]=best.params,hill=Math.exp(logSlope),ec50=Math.exp(mid);
  const predict=x=>base+delta/(1+Math.exp(-hill*(Math.log(x>0?x:minimumPositive/10)-mid)));
  const logistic={model:"4PL",bottom:base,top:base+delta,ec50,hill,predict,...calibrationR2(points,predict)};
  const safe=value=>Math.max(value,1e-12),n=points.length;
  const linearAic=n*Math.log(safe(linear.sse)/n)+4;
  const logisticAic=n*Math.log(safe(logistic.sse)/n)+8;
  return logisticAic+2<linearAic?logistic:linear;
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
