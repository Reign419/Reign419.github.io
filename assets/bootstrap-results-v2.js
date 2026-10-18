import {i as getReact, t as getReactDom} from "./framework-CXnKph_e.js";
import App from "./page-results-v2.js?v=20261018-delete-v1";
getReactDom().hydrateRoot(document.getElementById("plantsos-root"),getReact().createElement(App));
window.addEventListener("load",()=>{
  if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js").catch(error=>console.warn("PlantSOS service worker:",error));
},{once:true});
