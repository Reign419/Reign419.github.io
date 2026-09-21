const PHASE_LANGUAGE_KEY="plantsos-language-v1";
let installPrompt=null;
let sourceModal=null;
let installModal=null;
let settingsModal=null;
let refreshQueued=false;

window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event});
window.addEventListener('appinstalled',()=>{installPrompt=null;if(document.body)showToast(p('alreadyInstalled'))});

const phaseCopy={
  zh:{device:"设备",settings:"设置",dataSource:"数据来源",install:"安装",chooseSource:"选择数据来源",close:"关闭",connectTitle:"连接仪器",connectDesc:"通过 BLE 或 Wi-Fi 接收 PlantSOS 实时测量数据",importTitle:"导入文件",importDesc:"读取 XLSX、XLS、CSV 或 TSV 文件",demoTitle:"演示实验",demoDesc:"恢复内置示例实验数据",installTitle:"添加到主屏幕",iosInstall:"在 Safari 中点击“分享”，然后选择“添加到主屏幕”。",otherInstall:"打开浏览器菜单，然后选择“安装应用”或“添加到主屏幕”。",alreadyInstalled:"PlantSOS 已经安装在主屏幕。",installUnavailable:"浏览器尚未提供自动安装，请使用浏览器菜单添加到主屏幕。",settingsTitle:"应用设置",language:"语言",languageDesc:"选择界面显示语言",localData:"本地数据",localDataDesc:"检测文件和连接记录仅保存在当前设备",demoLoaded:"已恢复演示实验"},
  en:{device:"Device",settings:"Settings",dataSource:"Data source",install:"Install",chooseSource:"Choose data source",close:"Close",connectTitle:"Connect instrument",connectDesc:"Receive live PlantSOS measurements over BLE or Wi-Fi",importTitle:"Import file",importDesc:"Open an XLSX, XLS, CSV, or TSV file",demoTitle:"Demo experiment",demoDesc:"Restore the built-in example experiment",installTitle:"Add to Home Screen",iosInstall:"In Safari, tap Share, then select Add to Home Screen.",otherInstall:"Open the browser menu, then choose Install app or Add to Home Screen.",alreadyInstalled:"PlantSOS is already installed on this device.",installUnavailable:"Automatic installation is not available yet. Use the browser menu to add this app to your home screen.",settingsTitle:"App settings",language:"Language",languageDesc:"Choose the interface language",localData:"Local data",localDataDesc:"Measurement files and connection history stay on this device",demoLoaded:"Demo experiment restored"}
};

function phaseLanguage(){const active=[...document.querySelectorAll('.language-switch button')].find(button=>button.classList.contains('active'));return active?.textContent.trim()==='中文'?'zh':'en'}
function p(key){return phaseCopy[phaseLanguage()][key]}
function setText(element,value){if(element&&element.textContent!==value)element.textContent=value}
function makeButton(kind,icon){const button=document.createElement('button');button.type='button';button.dataset[`phase${kind[0].toUpperCase()}${kind.slice(1)}`]='true';button.innerHTML=`<i>${icon}</i><span></span>`;return button}

function setInitialLanguage(){
  const buttons=[...document.querySelectorAll('.language-switch button')];if(buttons.length<2)return;
  buttons.forEach(button=>{if(button.dataset.phaseLanguageBound)return;button.dataset.phaseLanguageBound='true';button.addEventListener('click',()=>{const selected=button.textContent.trim()==='中文'?'zh':'en';localStorage.setItem(PHASE_LANGUAGE_KEY,selected);document.documentElement.lang=selected==='zh'?'zh-CN':'en';setTimeout(refreshPhaseUi,0)})});
  const preferred=localStorage.getItem(PHASE_LANGUAGE_KEY)||'en';const target=buttons.find(button=>button.textContent.trim()===(preferred==='zh'?'中文':'EN'));if(target&&!target.classList.contains('active'))target.click();
}

function ensureNavigation(){
  const sideNav=document.querySelector('.side-rail nav');
  if(sideNav&&!sideNav.querySelector('[data-phase-device]')){const device=makeButton('device','◉');sideNav.insertBefore(device,sideNav.children[1]||null)}
  if(sideNav&&!sideNav.querySelector('[data-phase-settings]')){const settings=makeButton('settings','⚙');sideNav.append(settings)}
  const bottomNav=document.querySelector('.bottom-nav');
  if(bottomNav&&!bottomNav.querySelector('[data-phase-device]')){const device=makeButton('device','◉');bottomNav.insertBefore(device,bottomNav.children[1]||null)}
  const installButton=bottomNav?.lastElementChild;if(installButton)installButton.dataset.phaseInstall='true';
}

function createModal(className){const backdrop=document.createElement('div');backdrop.className=`phase-modal-backdrop ${className}`;backdrop.innerHTML='<section class="phase-modal" role="dialog" aria-modal="true"><header class="phase-modal-head"><h2></h2><button class="phase-modal-close" type="button">×</button></header><div class="phase-modal-body"></div></section>';document.body.append(backdrop);backdrop.querySelector('.phase-modal-close').addEventListener('click',()=>closeModal(backdrop));backdrop.addEventListener('click',event=>{if(event.target===backdrop)closeModal(backdrop)});return backdrop}
function openModal(modal){modal.classList.add('is-open');document.body.style.overflow='hidden';modal.querySelector('.phase-modal-close').focus()}
function closeModal(modal){modal.classList.remove('is-open');if(!document.querySelector('.phase-modal-backdrop.is-open,.ble-backdrop.is-open'))document.body.style.overflow=''}

function ensureSourceModal(){if(sourceModal)return;sourceModal=createModal('phase-source-modal');sourceModal.querySelector('.phase-modal-body').innerHTML='<div class="phase-source-list"><button class="phase-source-option" data-source-device type="button"><span class="phase-source-icon">◉</span><span class="phase-source-copy"><strong></strong><small></small></span><span class="phase-source-arrow">→</span></button><button class="phase-source-option" data-source-file type="button"><span class="phase-source-icon">▤</span><span class="phase-source-copy"><strong></strong><small></small></span><span class="phase-source-arrow">→</span></button><button class="phase-source-option" data-source-demo type="button"><span class="phase-source-icon">◇</span><span class="phase-source-copy"><strong></strong><small></small></span><span class="phase-source-arrow">→</span></button></div>';sourceModal.querySelector('[data-source-device]').addEventListener('click',()=>{closeModal(sourceModal);openDevicePanel()});sourceModal.querySelector('[data-source-file]').addEventListener('click',()=>{closeModal(sourceModal);document.querySelector('input[type=file]')?.click()});sourceModal.querySelector('[data-source-demo]').addEventListener('click',()=>{localStorage.removeItem('plantsos-ble-history-v1');location.reload()})}
function ensureInstallModal(){if(installModal)return;installModal=createModal('phase-install-modal');installModal.querySelector('.phase-modal-body').innerHTML='<div class="phase-install-copy"></div>'}
function ensureSettingsModal(){if(settingsModal)return;settingsModal=createModal('phase-settings-modal');settingsModal.querySelector('.phase-modal-body').innerHTML='<div class="phase-setting-row"><div><strong data-setting-language></strong><small data-setting-language-desc></small></div><div class="phase-language-buttons"><button type="button" data-lang="zh">中文</button><button type="button" data-lang="en">EN</button></div></div><div class="phase-setting-row"><div><strong data-setting-local></strong><small data-setting-local-desc></small></div><span>✓</span></div>';settingsModal.querySelectorAll('[data-lang]').forEach(button=>button.addEventListener('click',()=>{const target=[...document.querySelectorAll('.language-switch button')].find(item=>item.textContent.trim()===(button.dataset.lang==='zh'?'中文':'EN'));target?.click()}))}

function openSourceModal(){ensureSourceModal();refreshPhaseUi();openModal(sourceModal)}
function openDevicePanel(){document.querySelector('.ble-fab')?.click()}
function openSettings(){ensureSettingsModal();refreshPhaseUi();openModal(settingsModal)}
function isIos(){return /iphone|ipad|ipod/i.test(navigator.userAgent)}
function isStandalone(){return window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true}
async function installApp(){if(isStandalone()){showToast(p('alreadyInstalled'));return}if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;return}ensureInstallModal();installModal.querySelector('.phase-install-copy').textContent=isIos()?p('iosInstall'):p('otherInstall');refreshPhaseUi();openModal(installModal)}

function showToast(message){document.querySelector('.phase-toast')?.remove();const toast=document.createElement('div');toast.className='phase-toast';toast.textContent=message;document.body.append(toast);setTimeout(()=>toast.remove(),2600)}

function refreshPhaseUi(){
  ensureNavigation();document.querySelectorAll('[data-phase-device] span').forEach(span=>setText(span,p('device')));document.querySelectorAll('[data-phase-settings] span').forEach(span=>setText(span,p('settings')));document.querySelectorAll('[data-phase-install] span').forEach(span=>setText(span,p('install')));setText(document.querySelector('.import-button'),p('dataSource'));
  if(sourceModal){setText(sourceModal.querySelector('h2'),p('chooseSource'));sourceModal.querySelector('.phase-modal-close').setAttribute('aria-label',p('close'));const options=sourceModal.querySelectorAll('.phase-source-option');[["connectTitle","connectDesc"],["importTitle","importDesc"],["demoTitle","demoDesc"]].forEach((keys,index)=>{setText(options[index].querySelector('strong'),p(keys[0]));setText(options[index].querySelector('small'),p(keys[1]))})}
  if(installModal){setText(installModal.querySelector('h2'),p('installTitle'));installModal.querySelector('.phase-modal-close').setAttribute('aria-label',p('close'))}
  if(settingsModal){setText(settingsModal.querySelector('h2'),p('settingsTitle'));setText(settingsModal.querySelector('[data-setting-language]'),p('language'));setText(settingsModal.querySelector('[data-setting-language-desc]'),p('languageDesc'));setText(settingsModal.querySelector('[data-setting-local]'),p('localData'));setText(settingsModal.querySelector('[data-setting-local-desc]'),p('localDataDesc'))}
}

function queueRefresh(){if(refreshQueued)return;refreshQueued=true;requestAnimationFrame(()=>{refreshQueued=false;ensureNavigation();refreshPhaseUi()})}
function handlePhaseClick(event){const target=event.target.closest('button');if(!target)return;if(target.matches('.import-button,.scan-action')){event.preventDefault();event.stopImmediatePropagation();openSourceModal();return}if(target.matches('[data-phase-device]')){event.preventDefault();event.stopImmediatePropagation();openDevicePanel();return}if(target.matches('[data-phase-settings]')){event.preventDefault();event.stopImmediatePropagation();openSettings();return}if(target.matches('[data-phase-install]')){event.preventDefault();event.stopImmediatePropagation();installApp()}}

function initializePhaseOne(){setInitialLanguage();ensureNavigation();ensureSourceModal();ensureInstallModal();ensureSettingsModal();refreshPhaseUi();document.addEventListener('click',handlePhaseClick,true);new MutationObserver(queueRefresh).observe(document.querySelector('.app-shell')||document.body,{childList:true,subtree:true})}

document.readyState==='complete'?setTimeout(initializePhaseOne,350):window.addEventListener('load',()=>setTimeout(initializePhaseOne,350),{once:true});
