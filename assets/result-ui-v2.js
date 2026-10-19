import * as data from "./result-data-v2.js?v=20261018-normal-ranges-v3";
export function makeUi(React, JSX) {
  const h = (tag, props, ...children) => JSX.jsxs(tag, {...props, children});
  const text = (locale, zh, en) => locale === "zh" ? zh : en;
  const sampleText = (locale, value) => {
    const sample = String(value ?? "");
    if (locale === "zh") return sample;
    return sample
      .replace(/演示植株/g, "Demo plant")
      .replace(/模拟植株/g, "Simulated plant")
      .replace(/^样本/g, "Sample")
      .replace(/叶片/g, "Leaf")
      .replace(/对照/g, "Control")
      .replace(/水稻/g, "Rice")
      .replace(/拟南芥/g, "Arabidopsis");
  };
  function Filters({records, selected, onChange, locale}) {
    const choices = [...new Set(["SA", "ABA", "JA-Ile", ...records.map(row => row.analyte)])];
    return h("div", {className:"overview-select"},
      h("strong", {}, text(locale,"统计激素","Analyte summary")),
      h("div", {className:"filter-row"}, ...choices.map(analyte => h("button", {
        type:"button", key:analyte, className:selected === analyte ? "active" : "",
        "aria-pressed": selected === analyte, onClick:() => onChange(analyte)
      }, analyte))));
  }
  function Plot({records, locale, analyte}) {
    const rows = records.filter(row => data.finiteNumber(row.signal) !== null);
    if (!rows.length) return h("div", {className:"result-plot-empty"},
      h("strong", {}, text(locale,"暂无采集信号点","No acquired signal points")),
      h("p", {}, text(locale,"已有浓度仍按文件原值显示。","Provided concentrations are still preserved.")));
    const width=360, height=220, left=55, right=18, top=20, bottom=45;
    const signals=rows.map(row=>row.signal), lo=Math.min(0,...signals), hi=Math.max(0,...signals);
    const padding=(hi-lo || 1)*0.08, min=lo-padding, max=hi+padding;
    const x=index=>left+(rows.length===1?0.5:index/(rows.length-1))*(width-left-right);
    const y=value=>top+(max-value)/(max-min)*(height-top-bottom);
    const ticks=[min+(max-min)*0.08,(min+max)/2,max-(max-min)*0.08];
    const dots=rows.map((row,index)=>h("g",{key:row.id+"-"+index},
      h("circle",{cx:x(index),cy:y(row.signal),r:5,className:"standard-dot"},
        h("title",{},[sampleText(locale,row.sample),row.well,row.signal].join(" · "))),
      ...(rows.length <= 12 ? [h("text",{x:x(index),y:height-20,textAnchor:"middle"},row.well || String(index+1))] : [])));
    return h("div",{className:"sample-signal-plot"},
      h("p",{},analyte+" · "+text(locale,"样本采集信号","Sample acquired signals")),
      h("svg",{className:"curve-chart",viewBox:"0 0 "+width+" "+height,role:"img",
        "aria-label":text(locale,"样本采集信号散点图，不是标准曲线","Sample signal scatter plot, not a calibration curve")},
        ...ticks.map((tick,index)=>h("g",{key:"tick-"+index},
          h("line",{x1:left,x2:width-right,y1:y(tick),y2:y(tick),className:"gridline"}),
          h("text",{x:left-8,y:y(tick)+4,textAnchor:"end"},data.formatNumber(tick)))),
        h("line",{x1:left,x2:left,y1:top,y2:height-bottom,className:"axis"}),
        h("line",{x1:left,x2:width-right,y1:height-bottom,y2:height-bottom,className:"axis"}),
        ...dots),
      h("small",{},rows.length+" "+text(locale,"个实际导入/接收点 · 未拟合","imported / received points · No fitting")));
  }
  function Calibration({locale, records=[], onImport}) {
    const analytes=["SA","ABA","JA-Ile"];
    const countPairs=analyte=>records.filter(row=>
      data.normalizeAnalyte(row.analyte)===analyte &&
      data.finiteNumber(row.concentration)!==null &&
      data.finiteNumber(row.signal)!==null).length;
    const totalPairs=analytes.reduce((sum,analyte)=>sum+countPairs(analyte),0);
    const [selected,setSelected]=React.useState(analytes.find(analyte=>countPairs(analyte)>0)||"SA");
    const selectedUnit=records.find(row=>data.normalizeAnalyte(row.analyte)===selected&&data.finiteNumber(row.concentration)!==null&&row.unit)?.unit||"";
    const selectedRows=records.map(row=>({row,x:data.convertConcentration(row,selectedUnit),y:data.finiteNumber(row.signal)}))
      .filter(point=>data.normalizeAnalyte(point.row.analyte)===selected&&point.x!==null&&point.y!==null)
      .sort((a,b)=>a.x-b.x);
    const fit=data.fitCalibration(selectedRows.map(point=>({x:point.x,y:point.y})));
    const virtualSource=selectedRows.find(point=>/^(simulation|demo|test)$/i.test(String(point.row.source||"")))?.row.source;
    const virtualLabel=selectedRows.find(point=>/(模拟|测试|demo|test|sim)/i.test(`${point.row.sample} ${point.row.run} ${point.row.time}`));
    const virtualReason=virtualSource?
      text(locale,`数据来源被标记为 ${virtualSource}`,`source is marked as ${virtualSource}`):
      virtualLabel?text(locale,"样本名、批次或时间字段包含测试标记","sample, run, or time fields contain a test marker"):"";
    const plot=selectedRows.length>=2?(()=>{
      const width=720,height=310,left=68,right=24,top=24,bottom=58;
      const xs=selectedRows.map(point=>point.x),ys=selectedRows.map(point=>point.y);
      const xMin=Math.min(...xs),xMax=Math.max(...xs),yMin=Math.min(...ys),yMax=Math.max(...ys);
      const xPad=(xMax-xMin||1)*.08,yPad=(yMax-yMin||1)*.1;
      const x0=xMin-xPad,x1=xMax+xPad,y0=yMin-yPad,y1=yMax+yPad;
      const px=value=>left+(value-x0)/(x1-x0)*(width-left-right);
      const py=value=>top+(y1-value)/(y1-y0)*(height-top-bottom);
      const xTicks=Array.from({length:4},(_,index)=>x0+(x1-x0)*index/3);
      const yTicks=Array.from({length:4},(_,index)=>y0+(y1-y0)*index/3);
      const fitPath=fit?Array.from({length:100},(_,index)=>{
        const x=xMin+(xMax-xMin)*index/99;
        return `${index?"L":"M"}${px(x).toFixed(2)},${py(fit.predict(x)).toFixed(2)}`;
      }).join(" "):"";
      return h("section",{className:"candidate-calibration-plot"},
        h("div",{className:"candidate-plot-heading"},
          h("h3",{},selected+text(locale," · 浓度–信号图"," · Concentration–signal plot")),
          h("span",{},fit?`${fit.model} · R² ${Math.max(-9.999,fit.r2).toFixed(3)}`:text(locale,"数据不足","Insufficient data"))),
        h("svg",{className:"curve-chart",viewBox:`0 0 ${width} ${height}`,role:"img",
          "aria-label":text(locale,`${selected} 数据拟合图`,`${selected} fitted data plot`)},
          ...yTicks.map((tick,index)=>h("g",{key:"y-"+index},
            h("line",{x1:left,x2:width-right,y1:py(tick),y2:py(tick),className:"gridline"}),
            h("text",{x:left-10,y:py(tick)+4,textAnchor:"end"},data.formatNumber(tick)))),
          ...xTicks.map((tick,index)=>h("text",{key:"x-"+index,x:px(tick),y:height-30,textAnchor:"middle"},data.formatNumber(tick))),
          h("line",{x1:left,x2:left,y1:top,y2:height-bottom,className:"axis"}),
          h("line",{x1:left,x2:width-right,y1:height-bottom,y2:height-bottom,className:"axis"}),
          fitPath&&h("path",{d:fitPath,className:"calibration-fit-line"}),
          ...selectedRows.map((point,index)=>h("circle",{
            key:point.row.id+"-"+index,cx:px(point.x),cy:py(point.y),r:6,
            className:"calibration-dot"+(data.recordStatus(point.row).code==="NORMAL"?"":" qc-alert")
          },h("title",{},`${sampleText(locale,point.row.sample)||point.row.well} · ${data.formatNumber(point.x)} ${selectedUnit} · ${data.formatNumber(point.y)}`))),
          h("text",{x:(left+width-right)/2,y:height-7,textAnchor:"middle",className:"axis-label"},
            text(locale,"已知浓度","Known concentration")+(selectedUnit?` (${selectedUnit})`:"")),
          h("text",{x:left+8,y:16,className:"axis-label"},text(locale,"采集信号","Signal"))),
        fit&&h("div",{className:"fit-summary"},fit.model==="4PL"?
          `4PL · Bottom ${data.formatNumber(fit.bottom)} · Top ${data.formatNumber(fit.top)} · EC50 ${data.formatNumber(fit.ec50)} · Hill ${data.formatNumber(fit.hill)}`:
          text(locale,"线性拟合","Linear fit")+` · y = ${data.formatNumber(fit.slope)}x + ${data.formatNumber(fit.intercept)}`),
        h("p",{},selectedRows.length+text(locale," 个浓度–信号点已完成自动分析。"," concentration–signal pairs analyzed.")),
        fit&&fit.r2<.9&&h("p",{className:"analysis-warning"},text(locale,
          `拟合度较低（R² ${fit.r2.toFixed(3)}），数据离散较大或当前模型不适合。`,
          `Low fit quality (R² ${fit.r2.toFixed(3)}); the data are dispersed or the model is unsuitable.`)),
        fit&&virtualReason&&h("p",{className:"analysis-warning"},text(locale,
          `这些数据可能是模拟或测试数据：${virtualReason}。分析结果仅供流程检查。`,
          `These may be simulated or test data because ${virtualReason}. Use the analysis for workflow checks only.`)));
    })():null;
    return h("section",{className:"panel calibration-state"},
      h("div",{className:"calibration-heading"},
        h("div",{},
          h("h2",{},text(locale,"数据拟合分析","Data fitting analysis")),
          h("p",{},text(locale,
            "系统会按分析物分别读取 value 与 signal，并自动选择线性或 4PL 模型进行拟合。",
            "The system reads value and signal for each analyte and automatically fits a linear or 4PL model.")))),
      h("button",{type:"button",className:"import-button calibration-import",onClick:onImport},
        text(locale,"导入数据并分析","Import and analyze")),
      h("p",{className:"calibration-format"},text(locale,
        "分析字段：analyte、value、unit、signal；同一分析物至少需要 2 个不同的 value。",
        "Analysis fields: analyte, value, unit and signal. Each analyte needs at least 2 distinct values.")),
      h("div",{className:"calibration-progress","aria-label":text(locale,"分析数据点数量","Analysis data points")},
        ...analytes.map(analyte=>{
          const count=countPairs(analyte),ready=count>=2;
          return h("button",{type:"button",className:"calibration-analyte"+(selected===analyte?" selected":""),key:analyte,onClick:()=>setSelected(analyte)},
            h("strong",{},analyte),
            h("span",{className:ready?"ready":"pending"},
              count+text(locale," 个数据点"," data points")),
            h("small",{},ready?text(locale,"可进行拟合分析","Ready for fitting"):
              text(locale,"至少需要 2 个","At least 2 required")));
        })),
      plot||totalPairs>0&&h("div",{className:"candidate-plot-empty"},text(locale,
        "所选分析物至少需要 2 个浓度–信号点才能绘图。",
        "The selected analyte needs at least 2 concentration–signal pairs to plot.")));
  }
  function HistoryTrend({records, locale, analyte}) {
    const samples=[...new Set(records.filter(row=>data.normalizeAnalyte(row.analyte)===data.normalizeAnalyte(analyte)).map(row=>row.sample).filter(Boolean))];
    const [sample,setSample]=React.useState("all");
    React.useEffect(()=>{if(sample!=="all"&&!samples.includes(sample))setSample("all")},[analyte,records.length]);
    const series=data.trendSeries(records,analyte,sample),points=series.points,range=data.normalRange(analyte);
    const advice=data.nextStepAdvice(records,analyte,sample,locale);
    const width=760,height=300,left=66,right=28,top=28,bottom=58;
    let chart=null;
    if(points.length){
      const times=points.map(point=>new Date(point.timestamp).getTime()),values=points.map(point=>point.value);
      const t0=Math.min(...times),t1=Math.max(...times),v0=Math.min(...values),v1=Math.max(...values);
      const x=(time,index)=>left+(t1===t0?(points.length===1?.5:index/Math.max(1,points.length-1)):(time-t0)/(t1-t0))*(width-left-right);
      const pad=(v1-v0||Math.max(Math.abs(v1),1))*.12,y0=Math.max(0,v0-pad),y1=v1+pad;
      const y=value=>top+(y1-value)/(y1-y0||1)*(height-top-bottom);
      const line=points.map((point,index)=>`${index?"L":"M"}${x(times[index],index).toFixed(2)},${y(point.value).toFixed(2)}`).join(" ");
      const ticks=[y0,(y0+y1)/2,y1];
      chart=h("svg",{className:"history-chart",viewBox:`0 0 ${width} ${height}`,role:"img","aria-label":text(locale,`${analyte} 历史趋势`,`${analyte} historical trend`)},
        ...ticks.map((tick,index)=>h("g",{key:"h-y-"+index},h("line",{x1:left,x2:width-right,y1:y(tick),y2:y(tick),className:"gridline"}),h("text",{x:left-9,y:y(tick)+4,textAnchor:"end"},data.formatNumber(tick)))),
        h("line",{x1:left,x2:left,y1:top,y2:height-bottom,className:"axis"}),h("line",{x1:left,x2:width-right,y1:height-bottom,y2:height-bottom,className:"axis"}),
        points.length>1&&h("path",{d:line,className:"history-line"}),
        ...points.map((point,index)=>h("g",{key:point.timestamp+"-"+index},
          h("circle",{cx:x(times[index],index),cy:y(point.value),r:6,className:"history-dot"},h("title",{},`${data.recordDate(point.row)} · ${data.formatNumber(point.value)} ${series.unit}`)),
          (points.length<=8||index===0||index===points.length-1)&&h("text",{x:x(times[index],index),y:height-28,textAnchor:"middle"},data.recordDate(point.row).slice(5)))));
    }
    return h("section",{className:"panel history-panel"},
      h("div",{className:"history-heading"},h("div",{},h("h2",{},text(locale,"历史趋势与下一步建议","History trend and next step")),
        h("p",{},text(locale,"按记录日期分析；“全部样本”显示该激素每天的平均浓度。","Analysed by record date; All samples shows the daily mean for this analyte.")),
        range&&h("p",{className:"normal-range-note"},text(locale,
          `正常范围 ${data.formatNumber(range.min)}–${data.formatNumber(range.max)} µM`,
          `Normal range ${data.formatNumber(range.min)}–${data.formatNumber(range.max)} µM`))),
        samples.length>0&&h("label",{className:"history-sample"},h("span",{},text(locale,"样本","Sample")),h("select",{value:sample,onChange:event=>setSample(event.target.value)},
          h("option",{value:"all"},text(locale,"全部样本","All samples")),...samples.map(name=>h("option",{value:name,key:name},sampleText(locale,name)))))),
      points.length?chart:h("div",{className:"history-empty"},text(locale,"导入至少一条带日期的有效浓度记录后显示趋势。","Import at least one dated concentration result to display a trend.")),
      h("div",{className:`advice-card ${advice.level}`},h("strong",{},advice.title),h("p",{},advice.text),h("small",{},advice.basis)),
      h("p",{className:"advice-disclaimer"},text(locale,"此建议依据指定正常范围、来源 QC 与相对变化规则，不是经验证的植物学诊断；处理植物前请结合实验设计和专业判断。","This suggestion uses the specified normal ranges, source QC and relative-change rules. It is not a validated plant diagnosis; consider the experimental design and expert judgement before acting.")));
  }
  function Notes({locale}) {
    return h("details",{className:"panel result-notes",open:true},
      h("summary",{},text(locale,"数据与采集说明","Data and acquisition notes")),
      h("p",{},text(locale,
        "PMT / 光学检测器及前端电路先将光转换为电信号，ADS1256 将电信号数字化，ESP32 传输采集数值与已有浓度。signal 的单位取决于原固件定义。",
        "The PMT / optical detector and front-end circuit convert light into an electrical signal. ADS1256 digitizes it; ESP32 transmits acquired readings and provided concentrations. Signal units follow the firmware definition.")),
      h("p",{},text(locale,
        "value 为设备或文件提供的浓度，unit 为浓度单位，qc 保留来源值；网站未重新验证设备标定。原始 signal 不会用演示曲线换算。相同激素的兼容浓度单位会统一后统计，单位缺失或不兼容的记录不纳入平均值。",
        "Value is a provided concentration; unit is its concentration unit. QC is preserved from the source; calibration has not been revalidated by this website. Raw signals are never converted using the demo curve. Compatible units are converted within one analyte; missing or incompatible units are excluded from its average.")),
      h("p",{},text(locale,
        "正常范围统一按 µM 判断：SA 0.3–3、ABA 0.005–0.05、JA-Ile 10–100。这些范围仅用于实验复核，尚未验证为植物生物学诊断阈值。",
        "Normal ranges are assessed in µM: SA 0.3–3, ABA 0.005–0.05 and JA-Ile 10–100. These are reference ranges for experimental review only; they are not validated biological diagnostic thresholds.")),
      h("p",{},text(locale,
        "BLE 面板保留最近 100 条浏览器记录，新接收或新导入的结果会去重后追加到当前历史。CSV 包含年月日和完整时间戳；原数据缺少有效日期时使用导入时间并标记。仪器 Wi-Fi 缓存为最近 96 条，断电清空；通过 CSV 导入本网站。数据仅在当前浏览器处理。",
        "The BLE panel keeps the latest 100 browser records. Newly received or imported results are deduplicated and appended to local history. CSV exports include a date and full timestamp; when the source has no valid date, import time is used and marked. Instrument Wi-Fi caches the latest 96 results in volatile memory; transfer them here through CSV. Data is processed in this browser.")));
  }
  function Export({records, locale}) {
    return h("button",{type:"button",className:"import-button result-export",disabled:!records.length,onClick:()=>{
      const url=URL.createObjectURL(new Blob([data.toCsv(records)],{type:"text/csv;charset=utf-8"}));
      const link=document.createElement("a");link.href=url;link.download=`PlantSOS-results-${new Date().toISOString().slice(0,10)}.csv`;link.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    }},text(locale,"导出本次结果 CSV","Export current results"));
  }
  return {Filters, Plot, Calibration, HistoryTrend, Notes, Export};
}
