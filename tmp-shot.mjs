import WebSocket from "ws";
import fs from "node:fs";

const url = process.argv[2] || "http://localhost:3000/catalogo";
const out = process.argv[3] || "C:/Users/Carlos/AppData/Local/Temp/opencode/shot.png";

const list = await (await fetch("http://127.0.0.1:9222/json/list")).json();
let target = list.find((t) => t.type === "page");
if (!target) target = await (await fetch("http://127.0.0.1:9222/json/new?url=about:blank", { method: "PUT" })).json();

const ws = new WebSocket(target.webSocketDebuggerUrl, { perMessageDeflate: false });
let id = 0;
const pending = new Map();
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });

ws.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  }
});

await new Promise((r) => ws.on("open", r));
await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url });
await new Promise((r) => setTimeout(r, 6000));
const { data } = await send("Page.captureScreenshot", { format: "png" });
fs.writeFileSync(out, Buffer.from(data, "base64"));
console.log("saved", out);
ws.close();
process.exit(0);
