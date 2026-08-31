import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const APP = "https://sitedoterra-psi.vercel.app";
const PNG = path.resolve("repro-tiny.png");

if (!fs.existsSync(PNG)) {
  fs.writeFileSync(PNG, Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64"
  ));
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

const page = await browser.newPage();
page.on("console", (msg) => {
  if (msg.type() === "error") console.log("[console:error]", msg.text());
});
page.on("pageerror", (err) => console.log("[pageerror]", err.message));

const navLog = [];
page.on("request", (req) => {
  const t = req.resourceType();
  if (t === "document" || t === "xhr" || t === "fetch") {
    navLog.push(`[req:${t}] ${req.method()} ${req.url().slice(0, 140)}`);
  }
});
page.on("framenavigated", (frame) => {
  if (frame === page.mainFrame()) navLog.push(`[nav] ${frame.url()}`);
});

async function waitFor(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function countEditorModals() {
  return page.evaluate(() => {
    const modals = Array.from(document.querySelectorAll(".fixed.inset-0.z-50"));
    const editor = modals.filter((m) => (m.querySelector("h3")?.textContent || "").includes("Editar —"));
    const picker = modals.filter((m) => (m.querySelector("h3")?.textContent || "").includes("Biblioteca de mídia"));
    return {
      url: location.pathname,
      editor: editor.length,
      picker: picker.length,
      bodySnippet: document.body.innerText.slice(0, 80).replace(/\n/g, " | "),
    };
  });
}

try {
  await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.evaluate(async () => {
    await fetch("/api/test-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  });
  await waitFor(1500);

  await page.goto(`${APP}/painel/meu-site`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(() => document.body.innerText.includes("História / Sobre"), { timeout: 45000 });
  console.log("page loaded");

  await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll(".space-y-2 .card"));
    for (const row of rows) {
      const label = row.querySelector("span.font-semibold");
      if (label && label.textContent && label.textContent.trim() === "História / Sobre") {
        const btn = Array.from(row.querySelectorAll("button")).find((b) => b.textContent && b.textContent.trim() === "Editar");
        if (btn) btn.click();
      }
    }
  });
  await waitFor(1500);
  console.log("after open editor:", JSON.stringify(await countEditorModals()));

  await page.evaluate(() => {
    const modal = document.querySelector(".fixed.inset-0.z-50");
    if (!modal) return;
    const btns = Array.from(modal.querySelectorAll("button")).filter((b) => b.textContent && b.textContent.includes("Escolher"));
    if (btns.length > 0) btns[0].click();
  });
  await waitFor(3000);
  console.log("after open picker:", JSON.stringify(await countEditorModals()));

  const fileInput = await page.$("input[type=file]");
  if (fileInput) {
    await fileInput.uploadFile(PNG);
    console.log("file uploaded to input, waiting...");
    for (let i = 0; i < 30; i++) {
      await waitFor(1000);
      const state = await countEditorModals();
      console.log(`t+${i + 1}s`, JSON.stringify(state));
      if (state.editor === 0 || state.url !== "/painel/meu-site") break;
    }
  } else {
    console.log("file input not found");
  }

  console.log("--- nav log ---");
  console.log(navLog.join("\n"));
} catch (err) {
  console.log("ERROR:", err.message);
  console.log(navLog.join("\n"));
} finally {
  await browser.close();
}