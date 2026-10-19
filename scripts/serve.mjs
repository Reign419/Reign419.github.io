import {createReadStream} from "node:fs";
import {stat} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", process.argv[2] || "build");
const port = Number(process.argv[3] || 8080);
const mime = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"]
]);

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://localhost");
  let relative = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  if (!relative) relative = "index.html";
  const requested = path.resolve(root, relative);
  if (requested !== root && !requested.startsWith(root + path.sep)) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const info = await stat(requested);
    const file = info.isDirectory() ? path.join(requested, "index.html") : requested;
    response.writeHead(200, {"Content-Type": mime.get(path.extname(file)) || "application/octet-stream"});
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404, {"Content-Type": "text/plain; charset=utf-8"}).end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`PlantSOS is available at http://127.0.0.1:${port}`);
});
