import{r as e}from"./rolldown-runtime-S-ySWqyJ.js";import{i as t}from"./framework-CXnKph_e.js";var n=e(t(),1);function r(){return(0,n.useEffect)(()=>{if(!(`serviceWorker`in navigator))return;let e=()=>navigator.serviceWorker.register(`/sw.js`).catch(()=>void 0);document.readyState===`complete`?e():window.addEventListener(`load`,e,{once:!0})},[]),null}export{r as default};
if(!document.querySelector('link[href="/ble.css"]')){const l=document.createElement("link");l.rel="stylesheet";l.href="/ble.css";document.head.append(l)}
if(!document.querySelector('link[href="/wifi.css"]')){const l=document.createElement("link");l.rel="stylesheet";l.href="/wifi.css";document.head.append(l)}
if(!document.querySelector('link[href="/phase1.css"]')){const l=document.createElement("link");l.rel="stylesheet";l.href="/phase1.css";document.head.append(l)}
if(!document.querySelector('script[src="/ble.js"]')){const s=document.createElement("script");s.type="module";s.src="/ble.js";document.body.append(s)}
if(!document.querySelector('script[src="/phase1.js"]')){const s=document.createElement("script");s.type="module";s.src="/phase1.js";document.body.append(s)}
