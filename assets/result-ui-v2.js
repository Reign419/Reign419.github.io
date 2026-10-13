import * as data from "./result-data-v2.js";
export function makeUi(React, JSX) {
  const h = (tag, props, ...children) => JSX.jsxs(tag, {...props, children});
  const text = (locale, zh, en) => locale === "zh" ? zh : en;
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
        h("title",{},[row.sample,row.well,row.signal].join(" · "))),
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
  function Calibration({locale, demo, DemoPlot}) {
    const [expanded,setExpanded]=React.useState(false);
    const show=demo || expanded;
    return h("section",{className:"panel calibration-state"},
      h("h2",{},text(locale,"标准曲线与标定","Calibration")),
      h("p",{},text(locale,
        "当前未建立真实标定曲线。样本结果不能替代已知浓度的标准品；SA、ABA 和 JA-Ile 需要各自的标定。",
        "No validated calibration is loaded. Sample results do not replace known-concentration standards. SA, ABA and JA-Ile need separate calibrations.")),
      h("p",{},text(locale,
        "已有 value 的记录直接显示。只有 signal 的记录保留采集读数并标为待标定；本版本不会自动拟合或换算浓度。",
        "Provided values are displayed directly. Signal-only records retain their readings and are marked uncalibrated. This version does not fit or calculate concentrations automatically.")),
      !demo && h("button",{type:"button",className:"import-button",onClick:()=>setExpanded(!expanded)},
        text(locale,expanded?"收起演示曲线":"查看独立演示曲线",expanded?"Hide demo curve":"View separate demo curve")),
      show && h("div",{className:"demo-curve-box"},
        h("strong",{},text(locale,"演示示意图 · 不用于本次样本计算","Illustration only · Not used for sample calculations")),
        JSX.jsx(DemoPlot,{locale}),
        h("p",{},text(locale,
          "7 个圆点是预设演示点，曲线由固定参数生成。没有进行本次实验拟合，不提供 R²。",
          "The 7 dots are preset examples and the curve uses fixed parameters. No experimental fit was performed; no R² is reported."))));
  }
  function Notes({locale}) {
    return h("details",{className:"panel result-notes"},
      h("summary",{},text(locale,"数据与采集说明","Data and acquisition notes")),
      h("p",{},text(locale,
        "PMT / 光学检测器及前端电路先将光转换为电信号，ADS1256 将电信号数字化，ESP32 传输采集数值与已有浓度。signal 的单位取决于原固件定义。",
        "The PMT / optical detector and front-end circuit convert light into an electrical signal. ADS1256 digitizes it; ESP32 transmits acquired readings and provided concentrations. Signal units follow the firmware definition.")),
      h("p",{},text(locale,
        "value 为设备或文件提供的浓度，unit 为浓度单位，qc 保留来源值；网站未重新验证设备标定。原始 signal 不会用演示曲线换算。相同激素的兼容浓度单位会统一后统计，单位缺失或不兼容的记录不纳入平均值。",
        "Value is a provided concentration; unit is its concentration unit. QC is preserved from the source; calibration has not been revalidated by this website. Raw signals are never converted using the demo curve. Compatible units are converted within one analyte; missing or incompatible units are excluded from its average.")),
      h("p",{},text(locale,
        "BLE 面板保留最近 100 条浏览器记录，新接收的结果同时进入本次主界面记录与统计。仪器 Wi-Fi 缓存为最近 96 条，断电清空；通过 CSV 导入本网站。数据仅在当前浏览器处理。",
        "The BLE panel keeps the latest 100 browser records. Newly received results also enter the current dashboard and statistics. Instrument Wi-Fi caches the latest 96 results in volatile memory; transfer them here through CSV. Data is processed in this browser.")));
  }
  function Export({records, locale}) {
    return h("button",{type:"button",className:"import-button",disabled:!records.length,onClick:()=>{
      const url=URL.createObjectURL(new Blob([data.toCsv(records)],{type:"text/csv;charset=utf-8"}));
      const link=document.createElement("a");link.href=url;link.download="PlantSOS-results.csv";link.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    }},text(locale,"导出本次结果 CSV","Export current results"));
  }
  return {Filters, Plot, Calibration, Notes, Export};
}
