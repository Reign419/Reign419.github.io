import {i as getReact, t as getReactDom} from "./framework-CXnKph_e.js";
import App from "./page-results-v2.js?v=20261018-normal-ranges-v3";
const root=document.getElementById("plantsos-root");
getReactDom().hydrateRoot(root,getReact().createElement(App),{onRecoverableError(){}});
window.addEventListener("load",()=>{
  if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js").catch(error=>console.warn("PlantSOS service worker:",error));
},{once:true});
