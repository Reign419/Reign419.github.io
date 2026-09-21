const BLE_SERVICE_UUID="6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const BLE_TX_UUID="6e400003-b5a3-f393-e0a9-e50e24dcca9e";
const BLE_DEVICE_PREFIX="iGEM-Photometer";
const HISTORY_KEY="plantsos-ble-history-v1";

const state={device:null,characteristic:null,bleConnected:false,wifiSocket:null,wifiConnected:false,receiveBuffers:{ble:"",wifi:""},simulatedSequence:1,history:loadHistory()};
const copy={
  zh:{launcher:"连接仪器",connectedLauncher:"仪器已连接",title:"连接检测仪",close:"关闭",disconnected:"未连接",connecting:"连接中",connected:"已连接",deviceHint:"支持 Wi-Fi 与 BLE 两种接收方式",connectBle:"连接 BLE",disconnectBle:"断开 BLE",connectWifi:"连接 Wi-Fi",disconnectWifi:"断开 Wi-Fi",openWifi:"打开 Wi-Fi 页面",wifiAddress:"仪器网页地址",simulate:"模拟一条数据",supported:"BLE：Android Chrome。Wi-Fi：iPhone、安卓和电脑均可，手机需先连接仪器热点。",unsupported:"当前浏览器不支持网页蓝牙，但仍可通过 Wi-Fi、模拟数据或表格导入。",latest:"最新结果",waiting:"等待数据",well:"孔位",signal:"光强",history:"接收记录",empty:"连接仪器或点击模拟按钮后，结果会显示在这里。",export:"导出 CSV",clear:"清空",noData:"暂无可导出的仪器记录。",connectError:"BLE 连接失败，请确认仪器已开机并正在广播。",wifiError:"Wi-Fi 连接失败，请确认手机已连接仪器热点。",simulated:"模拟",bleLive:"BLE 实时",wifiLive:"Wi-Fi 实时",both:"BLE + Wi-Fi"},
  en:{launcher:"Connect device",connectedLauncher:"Device connected",title:"Connect analyzer",close:"Close",disconnected:"Disconnected",connecting:"Connecting",connected:"Connected",deviceHint:"Receive results over Wi-Fi or BLE",connectBle:"Connect BLE",disconnectBle:"Disconnect BLE",connectWifi:"Connect Wi-Fi",disconnectWifi:"Disconnect Wi-Fi",openWifi:"Open Wi-Fi page",wifiAddress:"Analyzer page address",simulate:"Simulate result",supported:"BLE: Chrome on Android. Wi-Fi: iPhone, Android, and desktop after joining the analyzer hotspot.",unsupported:"Web Bluetooth is unavailable here, but Wi-Fi, simulation, and file import still work.",latest:"Latest result",waiting:"Waiting for data",well:"Well",signal:"Signal",history:"Received results",empty:"Connect the analyzer or simulate a result to see it here.",export:"Export CSV",clear:"Clear",noData:"There are no device results to export.",connectError:"BLE connection failed. Check that the analyzer is powered on and advertising.",wifiError:"Wi-Fi connection failed. Check that the phone is connected to the analyzer hotspot.",simulated:"Simulated",bleLive:"BLE live",wifiLive:"Wi-Fi live",both:"BLE + Wi-Fi"}
};
let ui={};

function language(){const buttons=[...document.querySelectorAll('.language-switch button')];return buttons.find(button=>button.classList.contains('active'))?.textContent.trim()==='EN'?'en':'zh'}
function t(key){return copy[language()][key]}
function loadHistory(){try{const parsed=JSON.parse(localStorage.getItem(HISTORY_KEY)||"[]");return Array.isArray(parsed)?parsed.slice(0,100):[]}catch{return[]}}
function saveHistory(){localStorage.setItem(HISTORY_KEY,JSON.stringify(state.history.slice(0,100)))}
function escapeHtml(value){return String(value??"").replace(/[&<>'"]/g,character=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[character])}
function normalizeWell(value){const match=String(value||"").trim().toUpperCase().match(/^([A-H])0?([1-9]|1[0-2])$/);return match?`${match[1]}${String(match[2]).padStart(2,"0")}`:String(value||"--").trim()}
function finiteNumber(value){if(value===undefined||value===null||String(value).trim()==="")return null;const number=Number(String(value).replace(/[^0-9+\-.eE]/g,""));return Number.isFinite(number)?number:null}

function normalizeResult(input,source="ble"){
  const concentration=finiteNumber(input.concentration??input.conc??input.value);
  if(concentration===null)return null;
  return{id:String(input.seq??input.sequence??`${Date.now()}-${Math.random().toString(16).slice(2)}`),sequence:input.seq??input.sequence??"",well:normalizeWell(input.well??input.position??input["孔位"]),hormone:String(input.hormone??input.analyte??input.type??"SA"),concentration,unit:String(input.unit??input.units??"µM"),signal:finiteNumber(input.signal??input.intensity??input.rlu??input["光强"]),qc:String(input.qc??input.status??"OK").toUpperCase(),source,receivedAt:new Date().toISOString()}
}

function parsePacket(raw,source="ble"){
  const text=String(raw||"").trim();if(!text)return null;
  if(text.startsWith("{")){try{return normalizeResult(JSON.parse(text),source)}catch{return null}}
  const fields=text.split(text.includes("|")?"|":",").map(field=>field.trim());if(fields.length<3)return null;
  if(/^[A-H]0?(?:[1-9]|1[0-2])$/i.test(fields[0]))return normalizeResult({well:fields[0],concentration:fields[1],unit:fields[2],qc:fields[3]||"OK",signal:fields[4],hormone:fields[5]},source);
  if(/^[A-H]0?(?:[1-9]|1[0-2])$/i.test(fields[1])){const hasUnit=fields[3]&&!/^(OK|LOW|HIGH|NO_CAL|BELOW_RANGE|ABOVE_RANGE|SATURATED)$/i.test(fields[3]);return normalizeResult({seq:fields[0],well:fields[1],concentration:fields[2],unit:hasUnit?fields[3]:"µM",qc:hasUnit?fields[4]:fields[3],signal:hasUnit?fields[5]:fields[4],hormone:hasUnit?fields[6]:fields[5]},source)}
  return null;
}

function defaultWifiAddress(){return location.hostname==='192.168.4.1'||location.protocol==='http:'?location.origin:'http://192.168.4.1'}
function anyConnected(){return state.bleConnected||state.wifiConnected}
function sourceLabel(source){return source==='simulation'?t('simulated'):source==='wifi'?t('wifiLive'):t('bleLive')}

function buildUi(){
  const launcher=document.createElement("button");launcher.className="ble-fab";launcher.type="button";
  const backdrop=document.createElement("div");backdrop.className="ble-backdrop";backdrop.innerHTML=`<section class="ble-panel" role="dialog" aria-modal="true" aria-labelledby="ble-title"><header class="ble-panel-header"><h2 id="ble-title"></h2><button class="ble-close" type="button">×</button></header><div class="ble-status-row"><div><strong class="ble-device-name">${BLE_DEVICE_PREFIX}</strong><span class="ble-status-note"></span></div><span class="ble-status-pill"></span></div><div class="ble-actions"><button class="ble-connect" type="button"></button><button class="ble-wifi" type="button"></button><button class="ble-simulate" type="button"></button></div><label class="ble-wifi-address"><span></span><input type="url" inputmode="url" value="${defaultWifiAddress()}" /></label><p class="ble-support-note"></p><article class="ble-latest"><p class="ble-latest-label"></p><div class="ble-reading"><strong>--</strong><span>µM</span></div><div class="ble-result-meta"><span class="ble-latest-well"></span><span class="ble-latest-signal"></span><span class="ble-qc">--</span></div></article><section class="ble-history"><div class="ble-history-head"><h3></h3><div class="ble-history-tools"><button class="ble-export" type="button"></button><button class="ble-clear" type="button"></button></div></div><div class="ble-history-list"></div></section></section>`;
  document.body.append(launcher,backdrop);
  ui={launcher,backdrop,panel:backdrop.querySelector('.ble-panel'),close:backdrop.querySelector('.ble-close'),title:backdrop.querySelector('#ble-title'),statusNote:backdrop.querySelector('.ble-status-note'),statusPill:backdrop.querySelector('.ble-status-pill'),connect:backdrop.querySelector('.ble-connect'),wifi:backdrop.querySelector('.ble-wifi'),wifiAddressLabel:backdrop.querySelector('.ble-wifi-address span'),wifiAddress:backdrop.querySelector('.ble-wifi-address input'),simulate:backdrop.querySelector('.ble-simulate'),support:backdrop.querySelector('.ble-support-note'),latestLabel:backdrop.querySelector('.ble-latest-label'),latestValue:backdrop.querySelector('.ble-reading strong'),latestUnit:backdrop.querySelector('.ble-reading span'),latestWell:backdrop.querySelector('.ble-latest-well'),latestSignal:backdrop.querySelector('.ble-latest-signal'),latestQc:backdrop.querySelector('.ble-qc'),historyTitle:backdrop.querySelector('.ble-history h3'),historyList:backdrop.querySelector('.ble-history-list'),export:backdrop.querySelector('.ble-export'),clear:backdrop.querySelector('.ble-clear')};
  launcher.addEventListener('click',()=>togglePanel(true));ui.close.addEventListener('click',()=>togglePanel(false));backdrop.addEventListener('click',event=>{if(event.target===backdrop)togglePanel(false)});ui.connect.addEventListener('click',()=>state.bleConnected?disconnectDevice():connectDevice());ui.wifi.addEventListener('click',()=>state.wifiConnected?disconnectWifi():connectWifi());ui.simulate.addEventListener('click',simulateResult);ui.export.addEventListener('click',exportCsv);ui.clear.addEventListener('click',clearHistory);document.addEventListener('keydown',event=>{if(event.key==='Escape')togglePanel(false)});
  updateLanguage();renderHistory();if(state.history[0])renderLatest(state.history[0]);
}

function togglePanel(open){ui.backdrop.classList.toggle('is-open',open);document.body.style.overflow=open?'hidden':'';if(open)ui.close.focus()}
function updateLanguage(){if(!ui.launcher)return;ui.launcher.textContent=anyConnected()?t('connectedLauncher'):t('launcher');ui.title.textContent=t('title');ui.close.setAttribute('aria-label',t('close'));ui.statusNote.textContent=t('deviceHint');ui.connect.textContent=state.bleConnected?t('disconnectBle'):t('connectBle');ui.wifi.textContent=state.wifiConnected?t('disconnectWifi'):(location.protocol==='https:'?t('openWifi'):t('connectWifi'));ui.wifiAddressLabel.textContent=t('wifiAddress');ui.simulate.textContent=t('simulate');ui.support.textContent='bluetooth'in navigator?t('supported'):t('unsupported');ui.latestLabel.textContent=state.history[0]?t('latest'):t('waiting');ui.historyTitle.textContent=t('history');ui.export.textContent=t('export');ui.clear.textContent=t('clear');updateConnectionStatus();renderHistory();if(state.history[0])renderLatest(state.history[0])}
function updateConnectionStatus(working=false){let label=t('disconnected');if(working)label=t('connecting');else if(state.bleConnected&&state.wifiConnected)label=t('both');else if(state.bleConnected)label='BLE';else if(state.wifiConnected)label='Wi-Fi';ui.statusPill.textContent=label;ui.statusPill.classList.toggle('connected',anyConnected());ui.launcher.dataset.state=anyConnected()?'connected':'disconnected'}

async function connectDevice(){
  if(!('bluetooth'in navigator)){alert(t('unsupported'));return}
  updateConnectionStatus(true);ui.connect.disabled=true;
  try{
    const device=await navigator.bluetooth.requestDevice({filters:[{namePrefix:BLE_DEVICE_PREFIX},{services:[BLE_SERVICE_UUID]}],optionalServices:[BLE_SERVICE_UUID]});device.addEventListener('gattserverdisconnected',handleDisconnect);
    const server=await device.gatt.connect();const service=await server.getPrimaryService(BLE_SERVICE_UUID);const characteristic=await service.getCharacteristic(BLE_TX_UUID);await characteristic.startNotifications();characteristic.addEventListener('characteristicvaluechanged',handleNotification);
    state.device=device;state.characteristic=characteristic;state.bleConnected=true;updateConnectionStatus();ui.connect.textContent=t('disconnectBle');ui.launcher.textContent=t('connectedLauncher');ui.statusNote.textContent=device.name||BLE_DEVICE_PREFIX;
  }catch(error){state.bleConnected=false;updateConnectionStatus();if(error?.name!=='NotFoundError')alert(`${t('connectError')}\n${error?.message||''}`)}finally{ui.connect.disabled=false}
}
function disconnectDevice(){if(state.device?.gatt?.connected)state.device.gatt.disconnect();handleDisconnect()}
function handleDisconnect(){state.bleConnected=false;state.characteristic=null;updateConnectionStatus();ui.connect.textContent=t('connectBle');ui.launcher.textContent=anyConnected()?t('connectedLauncher'):t('launcher');ui.statusNote.textContent=t('deviceHint')}

function normalizedHttpAddress(value){let address=String(value||'').trim();if(!/^[a-z]+:\/\//i.test(address))address=`http://${address}`;const url=new URL(address);url.pathname='/';url.search='';url.hash='';return url}
function wifiSocketAddress(httpUrl){const socketUrl=new URL(httpUrl);socketUrl.protocol=socketUrl.protocol==='https:'?'wss:':'ws:';socketUrl.pathname='/ws';return socketUrl.toString()}
function connectWifi(){
  let target;try{target=normalizedHttpAddress(ui.wifiAddress.value)}catch{alert(t('wifiError'));return}
  if(location.protocol==='https:'&&target.protocol==='http:'){location.assign(target.toString());return}
  updateConnectionStatus(true);ui.wifi.disabled=true;
  try{
    const socket=new WebSocket(wifiSocketAddress(target));state.wifiSocket=socket;
    socket.addEventListener('open',()=>{state.wifiConnected=true;ui.wifi.disabled=false;ui.wifi.textContent=t('disconnectWifi');ui.launcher.textContent=t('connectedLauncher');ui.statusNote.textContent=target.host;updateConnectionStatus()});
    socket.addEventListener('message',handleWifiMessage);
    socket.addEventListener('error',()=>{if(!state.wifiConnected)alert(t('wifiError'))});
    socket.addEventListener('close',()=>{state.wifiConnected=false;state.wifiSocket=null;ui.wifi.disabled=false;ui.wifi.textContent=location.protocol==='https:'?t('openWifi'):t('connectWifi');ui.launcher.textContent=anyConnected()?t('connectedLauncher'):t('launcher');ui.statusNote.textContent=t('deviceHint');updateConnectionStatus()});
  }catch{ui.wifi.disabled=false;updateConnectionStatus();alert(t('wifiError'))}
}
function disconnectWifi(){if(state.wifiSocket)state.wifiSocket.close();state.wifiConnected=false;state.wifiSocket=null;updateLanguage()}
async function handleWifiMessage(event){let chunk=event.data;if(chunk instanceof Blob)chunk=await chunk.text();else if(chunk instanceof ArrayBuffer)chunk=new TextDecoder().decode(chunk);handleTextChunk(String(chunk),'wifi')}

function handleNotification(event){
  handleTextChunk(new TextDecoder().decode(event.target.value),'ble');
}
function handleTextChunk(chunk,source){state.receiveBuffers[source]=(state.receiveBuffers[source]||'')+chunk;const lines=state.receiveBuffers[source].split(/\r?\n/);state.receiveBuffers[source]=lines.pop()||'';lines.filter(Boolean).forEach(line=>acceptPacket(line,source));const buffer=state.receiveBuffers[source];if(buffer&&(buffer.startsWith('{')&&buffer.endsWith('}')||/^[^,|]+[,|][^,|]+[,|]/.test(buffer))){const result=parsePacket(buffer,source);if(result){state.receiveBuffers[source]='';addResult(result)}}}
function acceptPacket(raw,source){const result=parsePacket(raw,source);if(result)addResult(result);else console.warn('PlantSOS: unrecognized device packet',raw)}
function simulateResult(){const index=(state.simulatedSequence-1)%96,row='ABCDEFGH'[Math.floor(index/12)],column=index%12+1,concentration=Number((3+Math.random()*140).toFixed(1));addResult(normalizeResult({seq:`SIM-${state.simulatedSequence++}`,well:`${row}${column}`,concentration,unit:'µM',qc:concentration>125?'ABOVE_RANGE':'OK',signal:Math.round(900+concentration*73),hormone:'SA'},'simulation'))}

function addResult(result){if(!result)return;const duplicate=result.sequence&&state.history.some(item=>item.sequence&&String(item.sequence)===String(result.sequence));if(duplicate)return;state.history.unshift(result);state.history=state.history.slice(0,100);saveHistory();renderLatest(result);renderHistory();syncDashboard(result);togglePanel(true)}
function renderLatest(result){ui.latestLabel.textContent=`${t('latest')} · ${sourceLabel(result.source)}`;ui.latestValue.textContent=result.concentration.toLocaleString(undefined,{maximumFractionDigits:3});ui.latestUnit.textContent=result.unit;ui.latestWell.textContent=`${t('well')} ${result.well}`;ui.latestSignal.textContent=result.signal===null?'':`${t('signal')} ${result.signal.toLocaleString()}`;ui.latestQc.textContent=result.qc}
function renderHistory(){if(!ui.historyList)return;if(!state.history.length){ui.historyList.innerHTML=`<p class="ble-history-empty">${escapeHtml(t('empty'))}</p>`;return}ui.historyList.innerHTML=state.history.slice(0,30).map(result=>`<article class="ble-history-item"><span class="ble-well">${escapeHtml(result.well)}</span><div class="ble-history-copy"><strong>${escapeHtml(result.hormone)} · ${escapeHtml(result.qc)}</strong><small>${new Date(result.receivedAt).toLocaleTimeString()}${result.signal===null?'':` · ${escapeHtml(t('signal'))} ${escapeHtml(result.signal)}`}</small></div><div class="ble-history-value">${escapeHtml(result.concentration)} ${escapeHtml(result.unit)}<small>${escapeHtml(sourceLabel(result.source))}</small></div></article>`).join('')}

function syncDashboard(result){
  const fileName=document.querySelector('.file-chip strong'),fileStatus=document.querySelector('.file-chip small'),statusPill=document.querySelector('.status-pill'),resultLabel=document.querySelector('.hero-copy>p'),resultValue=document.querySelector('.big-number strong'),resultUnit=document.querySelector('.big-number span'),resultNote=document.querySelector('.hero-copy>small'),deviceName=state.device?.name||BLE_DEVICE_PREFIX;
  if(fileName)fileName.textContent=result.source==='wifi'?'PlantSOS Wi-Fi':deviceName;if(fileStatus)fileStatus.textContent=sourceLabel(result.source);if(statusPill)statusPill.innerHTML=`<b></b>${escapeHtml(sourceLabel(result.source))}`;if(resultLabel)resultLabel.textContent=`${result.hormone} · ${result.well}`;if(resultValue)resultValue.textContent=result.concentration.toLocaleString(undefined,{maximumFractionDigits:3});if(resultUnit)resultUnit.textContent=result.unit;if(resultNote)resultNote.textContent=`${result.signal===null?'':`${t('signal')} ${result.signal.toLocaleString()} · `}QC ${result.qc}`;
  const wellMatch=result.well.match(/^([A-H])0?([1-9]|1[0-2])$/);if(wellMatch){const wellIndex='ABCDEFGH'.indexOf(wellMatch[1])*12+Number(wellMatch[2])-1,well=document.querySelectorAll('.plate-grid .well')[wellIndex];if(well){well.title=`${result.well} · ${result.concentration} ${result.unit}`;well.style.setProperty('--level',String(Math.max(.08,Math.min(1,result.concentration/150))))}}
}

function exportCsv(){if(!state.history.length){alert(t('noData'));return}const headers=['receivedAt','source','sequence','well','hormone','signal','concentration','unit','qc'],rows=state.history.map(result=>headers.map(key=>`"${String(result[key]??'').replace(/"/g,'""')}"`).join(',')),blob=new Blob(['\ufeff',headers.join(','),'\n',rows.join('\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`plantsos-ble-${new Date().toISOString().slice(0,10)}.csv`;link.click();URL.revokeObjectURL(url)}
function clearHistory(){state.history=[];saveHistory();renderHistory();ui.latestLabel.textContent=t('waiting');ui.latestValue.textContent='--';ui.latestUnit.textContent='µM';ui.latestWell.textContent='';ui.latestSignal.textContent='';ui.latestQc.textContent='--'}
function observeLanguageChanges(){const languageSwitch=document.querySelector('.language-switch');if(languageSwitch)new MutationObserver(updateLanguage).observe(languageSwitch,{attributes:true,subtree:true,attributeFilter:['class','aria-pressed']})}
function initializeBleUi(){window.setTimeout(()=>{if(document.querySelector('.ble-fab'))return;buildUi();observeLanguageChanges()},250)}
document.readyState==='complete'?initializeBleUi():window.addEventListener('load',initializeBleUi,{once:true});
