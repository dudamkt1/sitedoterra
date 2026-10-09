import WebSocket from "ws";
import fs from "node:fs";

const EMAIL = process.env.T_EMAIL;
const PASSWORD = process.env.T_PASSWORD;
const BASE = process.env.T_BASE || "http://localhost:3000";
const LOG = "C:/Users/Carlos/AppData/Local/Temp/opencode/admin-test.log";
fs.writeFileSync(LOG, `start ${new Date().toISOString()} base=${BASE}\n`);
const log = (...a) => fs.appendFileSync(LOG, a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ") + "\n");

const list = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const old = list.find((t) => t.type === "page");
if (old) await fetch(`http://127.0.0.1:9222/json/close/${old.id}`).catch(() => {});
const target = await (await fetch("http://127.0.0.1:9222/json/new?url=about:blank", { method: "PUT" })).json();
log("tab", target.id);

const ws = new WebSocket(target.webSocketDebuggerUrl, { perMessageDeflate: false });
let id = 0;
const pending = new Map();
const withTimeout = (p, ms, what) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout: " + what)), ms))]);
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
    setTimeout(() => {
      if (pending.has(mid)) {
        pending.delete(mid);
        reject(new Error("no response: " + method));
      }
    }, 120000);
  });
const errors = [];
ws.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  }
  if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
    errors.push(msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 300));
  }
  if (msg.method === "Runtime.exceptionThrown") {
    errors.push("EXC " + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text || "").slice(0, 300));
  }
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJs = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) return { error: r.exceptionDetails.exception?.description || r.exceptionDetails.text };
  return r.result.value;
};

await withTimeout(new Promise((r) => ws.on("open", r)), 10000, "ws-open");
await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

// 1. Login
await send("Page.navigate", { url: `${BASE}/login` });
await sleep(8000);
log("login page:", await evalJs("location.href"));
const loginRes = await evalJs(`(() => {
  const email = document.querySelector('input[type="email"]');
  const pass = document.querySelector('input[type="password"]');
  if (!email || !pass) return { found: false, body: (document.body.innerText||"").slice(0,300) };
  const set = (el, v) => {
    const proto = Object.getPrototypeOf(el);
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };
  set(email, ${JSON.stringify(EMAIL)});
  set(pass, ${JSON.stringify(PASSWORD)});
  const form = email.closest("form");
  const btn = form && form.querySelector('button[type="submit"]');
  if (!btn) return { found: true, submit: false };
  btn.click();
  return { found: true, submit: true };
})()`);
log("login:", loginRes);
let afterLogin = "";
for (let i = 0; i < 25; i++) {
  await sleep(1000);
  afterLogin = await evalJs("location.href");
  if (typeof afterLogin === "string" && !afterLogin.includes("/login")) break;
}
log("after login:", afterLogin);
log("login body:", await evalJs("(document.body.innerText||'').slice(0,400)"));

// 2. Admin catálogo
await send("Page.navigate", { url: `${BASE}/admin/catalogo` });
await sleep(20000);
const info = await evalJs(`(() => ({
  url: location.pathname,
  body: (document.body.innerText || "").slice(0, 900),
  aria: Array.from(document.querySelectorAll("button")).map(b => b.getAttribute("aria-label")).filter(Boolean),
  rows: document.querySelectorAll("tbody tr").length
}))()`);
log("admin:", info);
await send("Page.captureScreenshot", { format: "png" }).then(({ data }) =>
  fs.writeFileSync("C:/Users/Carlos/AppData/Local/Temp/opencode/admin-list.png", Buffer.from(data, "base64"))
);

// 3. Editar
log("click editar:", await evalJs(`(() => {
  const b = document.querySelector('button[aria-label="Editar"]');
  if (!b) return "no-edit-button";
  b.click(); return "clicked";
})()`));
await sleep(1500);
const modal = await evalJs(`(() => ({
  hasModal: !!document.querySelector(".fixed.inset-0.z-50"),
  title: (document.querySelector(".fixed.inset-0.z-50 h3") || {}).innerText || null,
  values: Array.from(document.querySelectorAll(".fixed.inset-0.z-50 input")).map(i => i.value)
}))()`);
log("modal:", modal);
await send("Page.captureScreenshot", { format: "png" }).then(({ data }) =>
  fs.writeFileSync("C:/Users/Carlos/AppData/Local/Temp/opencode/admin-edit.png", Buffer.from(data, "base64"))
);

// 4. Excluir
await evalJs(`(() => { const b = document.querySelector(".fixed.inset-0.z-50 button"); if (b) b.click(); return "closed"; })()`);
await sleep(800);
const beforeRows = await evalJs("document.querySelectorAll('tbody tr').length");
log("delete:", await evalJs(`(() => {
  window.__confirmCalled = false;
  window.confirm = () => { window.__confirmCalled = true; return false; };
  const b = document.querySelector('button[aria-label="Excluir"]');
  if (!b) return "no-del-button";
  b.click(); return "clicked";
})()`));
await sleep(3000);
const afterRows = await evalJs("document.querySelectorAll('tbody tr').length");
const confirmCalled = await evalJs("window.__confirmCalled === true");
log("rows before/after:", beforeRows, afterRows, "confirmCalled:", confirmCalled);
log("errors:", errors.slice(0, 8));
await send("Page.captureScreenshot", { format: "png" }).then(({ data }) =>
  fs.writeFileSync("C:/Users/Carlos/AppData/Local/Temp/opencode/admin-after-del.png", Buffer.from(data, "base64"))
);
log("done");
ws.close();
process.exit(0);
