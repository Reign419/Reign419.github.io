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
function localDateString(date) {
  const pad = value => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
export function normalizeTimestamp(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 1e12) return new Date(value).toISOString();
    if (value > 1e9) return new Date(value * 1000).toISOString();
    if (value > 20000 && value < 80000) return new Date(Date.UTC(1899, 11, 30) + value * 86400000).toISOString();
  }
  const text = String(value ?? "").trim();
  if (!text || /^\d+(?:\.\d+)?\s*(?:h|hr|hours?|min|minutes?|d|days?)$/i.test(text)) return "";
  if (/^\d+(?:\.\d+)?$/.test(text)) return normalizeTimestamp(Number(text));
  if (!/(?:19|20)\d{2}/.test(text)) return "";
  const normalized = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(text) ? text.replaceAll("/", "-") + "T00:00:00" : text;
  const parsed = new Date(normalized);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : "";
}
export function recordDate(row) {
  const timestamp = normalizeTimestamp(row?.recordedAt ?? row?.timestamp ?? row?.ts ?? row?.date);
  return timestamp ? localDateString(new Date(timestamp)) : "";
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
  const rawDate = pick(map, ["date", "measurementdate", "测量日期", "日期"]);
  const rawClock = pick(map, ["clock", "clocktime", "测量时间"]);
  const rawTime = pick(map, ["time", "时间"]);
  const rawTimestamp = pick(map, ["recorded_at", "recordedat", "timestamp", "datetime", "date_time", "ts", "receivedAt"])
    ?? (rawDate ? `${rawDate}${rawClock ? "T" + rawClock : ""}` : rawTime);
  const parsedTimestamp = normalizeTimestamp(rawTimestamp);
  const recordedAt = parsedTimestamp || new Date().toISOString();
  const declaredTimeSource = String(pick(map, ["time_source", "timesource"]) ?? "").toLowerCase();
  const timeSource = declaredTimeSource === "imported" || declaredTimeSource === "provided"
    ? declaredTimeSource : parsedTimestamp ? "provided" : "imported";
  const timepointValue = pick(map, ["timepoint", "elapsed", "elapsedtime", "elapsed_time", "时间点"]);
  const timepoint = String(timepointValue ?? (!normalizeTimestamp(rawTime) && !rawDate ? rawTime ?? "" : ""));
  return {
    id: String(pick(map, ["id"]) ?? (sequence !== "" ? [run, plate, sequence].join(":") : "row-" + index)),
    sequence, run, plate, well,
    sample: String(pick(map, ["sample", "sample_id", "样本", "样本名", "组别"]) ?? well ?? ""),
    analyte: normalizeAnalyte(pick(map, ["analyte", "hormone", "激素"])),
    signal, concentration,
    unit: normalizeUnit(pick(map, ["unit", "conc_unit", "units", "单位"])),
    qc: String(pick(map, ["qc", "status", "质控"]) ?? (concentration === null ? "NO_CAL" : "NOT_PROVIDED")),
    time: timepoint || recordedAt, timepoint, recordedAt, date: localDateString(new Date(recordedAt)), timeSource,
    source: String(pick(map, ["source"]) ?? source),
    concentrationSource: concentration === null ? "unavailable" : "provided"
  };
}
export function recordKey(row) {
  const sequence = String(row?.sequence ?? "");
  const identity = [row?.run, row?.plate, sequence, row?.well, normalizeAnalyte(row?.analyte), row?.sample].map(value=>String(value??"")).join("|");
  const measurement = [finiteNumber(row?.concentration), normalizeUnit(row?.unit), finiteNumber(row?.signal), String(row?.qc??"").toUpperCase()].join("|");
  const time = row?.timeSource === "provided" ? normalizeTimestamp(row?.recordedAt) : String(row?.timepoint ?? "");
  return [identity, measurement, time].join("|");
}
export function removeRecord(records, target) {
  const targetKey = typeof target === "string" ? target : recordKey(target);
  let removed = false;
  return (records || []).filter(row => {
    if (!removed && recordKey(row) === targetKey) {
      removed = true;
      return false;
    }
    return true;
  });
}
export function mergeRecords(existing, incoming, limit = 2000) {
  const output = [], seen = new Set();
  for (const row of [...(existing || []), ...(incoming || [])]) {
    const normalized = row?.concentrationSource ? row : normalizeResult(row, output.length, row?.source || "file");
    if (!normalized) continue;
    const key = recordKey(normalized);
    if (seen.has(key)) continue;
    seen.add(key); output.push(normalized);
  }
  return output.sort((a,b)=>normalizeTimestamp(a.recordedAt).localeCompare(normalizeTimestamp(b.recordedAt))).slice(-limit);
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
export const HORMONE_STANDARDS = Object.freeze({
  SA: Object.freeze({initial:1, min:0.3, max:3, unit:"µM"}),
  ABA: Object.freeze({initial:0.02, min:0.005, max:0.05, unit:"µM"}),
  "JA-Ile": Object.freeze({initial:50, min:10, max:100, unit:"µM"})
});
export function normalRange(analyte) {
  return HORMONE_STANDARDS[normalizeAnalyte(analyte)] || null;
}
export function classifyConcentration(analyte, value, unit) {
  const range = normalRange(analyte), number = finiteNumber(value), sourceUnit = normalizeUnit(unit);
  if (!range || number === null || !sourceUnit || !MOLAR[sourceUnit]) {
    return {status:"UNASSESSED", range, valueUm:null};
  }
  const valueUm = number * MOLAR[sourceUnit] / MOLAR[range.unit];
  const status = valueUm < range.min ? "BELOW_RANGE" : valueUm > range.max ? "ABOVE_RANGE" : "NORMAL";
  return {status, range, valueUm};
}
export function recordStatus(row) {
  const sourceQc = String(row?.qc || "").toUpperCase();
  const assessment = classifyConcentration(row?.analyte,row?.concentration,row?.unit);
  if (sourceQc === "SATURATED") return {code:"SATURATED", ...assessment};
  if (["HIGH","ABOVE_RANGE"].includes(sourceQc)) return {code:"ABOVE_RANGE", ...assessment};
  if (["LOW","BELOW_RANGE"].includes(sourceQc)) return {code:"BELOW_RANGE", ...assessment};
  if (finiteNumber(row?.concentration) === null || sourceQc === "NO_CAL") return {code:"UNCALIBRATED", ...assessment};
  if (sourceQc === "OK") return {code:"NORMAL", ...assessment};
  return {code:"UNASSESSED", ...assessment};
}
export function summarize(records, analyte) {
  const rows = records.filter(row => normalizeAnalyte(row.analyte) === normalizeAnalyte(analyte));
  const target = rows.find(row => finiteNumber(row.concentration) !== null && normalizeUnit(row.unit));
  const unit = normalizeUnit(target?.unit);
  const values = [];
  let excluded = 0, alerts = 0;
  for (const row of rows) {
    const value = finiteNumber(row.concentration), sourceUnit = normalizeUnit(row.unit);
    if (recordStatus(row).code !== "NORMAL") alerts++;
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
export function trendSeries(records, analyte, sample = "all") {
  const matching = (records || []).filter(row => normalizeAnalyte(row.analyte) === normalizeAnalyte(analyte)
    && (sample === "all" || row.sample === sample) && normalizeTimestamp(row.recordedAt));
  const target = matching.find(row => finiteNumber(row.concentration) !== null && normalizeUnit(row.unit));
  const unit = normalizeUnit(target?.unit);
  const points = matching.map(row=>({row, timestamp:normalizeTimestamp(row.recordedAt), value:convertConcentration(row, unit)}))
    .filter(point=>point.value!==null).sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
  if (sample !== "all") return {unit, points};
  const daily = new Map();
  for (const point of points) {
    const date = recordDate(point.row), bucket = daily.get(date) || [];
    bucket.push(point); daily.set(date,bucket);
  }
  return {unit, points:[...daily.entries()].map(([date,bucket])=>({
    timestamp:bucket[bucket.length-1].timestamp,
    value:bucket.reduce((sum,point)=>sum+point.value,0)/bucket.length,
    row:{...bucket[bucket.length-1].row,date,sample:"all"}, count:bucket.length
  })).sort((a,b)=>a.timestamp.localeCompare(b.timestamp))};
}
export function nextStepAdvice(records, analyte, sample = "all", locale = "zh") {
  const rows = (records || []).filter(row=>normalizeAnalyte(row.analyte)===normalizeAnalyte(analyte)
    && (sample==="all"||row.sample===sample));
  const tr = (zh,en)=>locale==="zh"?zh:en;
  const severe = rows.filter(row=>String(row.qc).toUpperCase()==="SATURATED");
  const uncalibrated = rows.filter(row=>row.concentration===null||String(row.qc).toUpperCase()==="NO_CAL");
  if (severe.length) return {level:"alert", title:tr("优先复核饱和信号","Review saturated signals first"),
    text:tr(`发现 ${severe.length} 条信号饱和记录。建议检查空白和标定状态，必要时稀释样本并重复测量。`,
      `${severe.length} saturated signal result(s) were found. Check blanks and calibration; dilute and repeat the sample when appropriate.`), basis:tr("依据：来源 QC 的信号饱和状态","Basis: saturated source QC status")};
  if (uncalibrated.length) return {level:"warn", title:tr("先完成标定再判断变化","Calibrate before interpreting change"),
    text:tr(`有 ${uncalibrated.length} 条记录只有 signal、没有有效浓度。请用对应激素的已知标准品完成标定后重新分析。`,
      `${uncalibrated.length} result(s) contain signal without a valid concentration. Calibrate with known standards for this analyte, then analyse again.`), basis:tr("依据：缺少有效浓度","Basis: valid concentration missing")};
  const series = trendSeries(rows, analyte, sample);
  const latestPoint=series.points.at(-1), latestAssessment=latestPoint?classifyConcentration(analyte,latestPoint.value,series.unit):null;
  if (latestAssessment?.status === "ABOVE_RANGE") return {level:"alert", title:tr("浓度高于正常范围","Concentration above the normal range"),
    text:tr(`最近浓度为 ${formatNumber(latestAssessment.valueUm)} µM，高于 ${analyte} 正常上限 ${formatNumber(latestAssessment.range.max)} µM。建议先复测确认，并结合植株症状、取样位置和环境条件判断。`,
      `The latest concentration is ${formatNumber(latestAssessment.valueUm)} µM, above the ${analyte} normal upper limit of ${formatNumber(latestAssessment.range.max)} µM. Repeat the measurement, then review plant symptoms, sampling position and environmental conditions.`),
    basis:tr(`正常范围：${formatNumber(latestAssessment.range.min)}–${formatNumber(latestAssessment.range.max)} µM`,`Normal range: ${formatNumber(latestAssessment.range.min)}–${formatNumber(latestAssessment.range.max)} µM`)};
  if (latestAssessment?.status === "BELOW_RANGE") return {level:"warn", title:tr("浓度低于正常范围","Concentration below the normal range"),
    text:tr(`最近浓度为 ${formatNumber(latestAssessment.valueUm)} µM，低于 ${analyte} 正常下限 ${formatNumber(latestAssessment.range.min)} µM。建议在相同条件下复测，并检查取样、保存和标定过程。`,
      `The latest concentration is ${formatNumber(latestAssessment.valueUm)} µM, below the ${analyte} normal lower limit of ${formatNumber(latestAssessment.range.min)} µM. Repeat under the same conditions and review sampling, storage and calibration.`),
    basis:tr(`正常范围：${formatNumber(latestAssessment.range.min)}–${formatNumber(latestAssessment.range.max)} µM`,`Normal range: ${formatNumber(latestAssessment.range.min)}–${formatNumber(latestAssessment.range.max)} µM`)};
  if (series.points.length < 2) {
    if (latestAssessment?.status === "NORMAL") return {level:"ok", title:tr("当前浓度在正常范围内","Current concentration is within the normal range"),
      text:tr("当前值处于该激素的正常范围；目前不足两个带日期的有效浓度点，建议在相同取样条件下增加下一次测量以判断趋势。",
        "The current value is within this hormone's normal range. Fewer than two dated points are available, so add another measurement under the same sampling conditions to assess the trend."),
      basis:tr(`正常范围：${formatNumber(latestAssessment.range.min)}–${formatNumber(latestAssessment.range.max)} µM`,`Normal range: ${formatNumber(latestAssessment.range.min)}–${formatNumber(latestAssessment.range.max)} µM`)};
    return {level:"info", title:tr("继续采集时间点","Collect another time point"),
      text:tr("目前不足两个带日期的有效浓度点，尚不能判断趋势。建议在相同取样条件下增加下一次测量。",
        "Fewer than two dated concentration points are available. Add another measurement under the same sampling conditions before interpreting a trend."),
      basis:tr("依据：有效时间点少于 2 个","Basis: fewer than 2 valid time points")};
  }
  const previous=series.points.at(-2), latest=series.points.at(-1);
  const change=previous.value===0?null:(latest.value-previous.value)/Math.abs(previous.value)*100;
  if (change===null) return {level:"info",title:tr("继续监测","Continue monitoring"),text:tr("上一时间点为零，无法计算可靠的相对变化；建议补充一次重复测量。","The previous value was zero, so a reliable relative change cannot be calculated. Add a repeat measurement."),basis:tr("依据：最近两个有效时间点","Basis: latest two valid time points")};
  if (change>=20) return {level:"warn",title:tr("浓度呈上升趋势","Concentration is trending upward"),
    text:tr(`最近一次较前一次升高 ${Math.abs(change).toFixed(1)}%。建议先复测确认，并结合植株症状、取样位置和环境条件判断。`,
      `The latest value is ${Math.abs(change).toFixed(1)}% higher than the previous value. Repeat the measurement, then review plant symptoms, sampling position and environmental conditions.`),basis:tr("规则：相邻时间点上升 ≥20%","Rule: ≥20% increase between adjacent time points")};
  if (change<=-20) return {level:"info",title:tr("浓度呈下降趋势","Concentration is trending downward"),
    text:tr(`最近一次较前一次降低 ${Math.abs(change).toFixed(1)}%。建议保持相同取样条件继续监测，以确认变化是否持续。`,
      `The latest value is ${Math.abs(change).toFixed(1)}% lower than the previous value. Continue monitoring under the same sampling conditions to confirm whether the change persists.`),basis:tr("规则：相邻时间点下降 ≥20%","Rule: ≥20% decrease between adjacent time points")};
  return {level:"ok",title:tr("近期变化相对稳定","Recent values are relatively stable"),
    text:tr(`最近两个时间点的变化为 ${change.toFixed(1)}%。建议按当前计划继续监测。`,
      `The change between the latest two time points is ${change.toFixed(1)}%. Continue monitoring on the current schedule.`),basis:tr("规则：相邻时间点变化小于 20%","Rule: change between adjacent time points is below 20%")};
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
  const status = recordStatus(row).code;
  const known = {
    NORMAL: ["正常", "Normal"],
    ABOVE_RANGE: ["高于正常范围", "Above normal"],
    BELOW_RANGE: ["低于正常范围", "Below normal"],
    SATURATED: ["信号饱和", "Saturated"],
    UNCALIBRATED: ["待标定", "Uncalibrated"],
    UNASSESSED: ["无法判断", "Not assessed"]
  };
  if (status === "UNASSESSED" && row.qc && String(row.qc).toUpperCase() !== "NOT_PROVIDED") return row.qc;
  return known[status]?.[locale === "zh" ? 0 : 1] ?? row.qc;
}
export function toCsv(records) {
  const headers = ["v","type","run","plate","well","sample","analyte","value","unit","qc","signal","date","recorded_at","time_source","timepoint","ts","seq"];
  const quote = value => '"' + String(value ?? "").replace(/"/g, '""') + '"';
  return "\ufeff" + headers.join(",") + "\r\n" + records.map(row => {
    const recordedAt = normalizeTimestamp(row.recordedAt) || new Date().toISOString();
    const data = {v:1, type:"result", ...row, value:row.concentration, date:recordDate({...row,recordedAt}),
      recorded_at:recordedAt, time_source:row.timeSource||"imported", timepoint:row.timepoint||"", ts:recordedAt, seq:row.sequence};
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
