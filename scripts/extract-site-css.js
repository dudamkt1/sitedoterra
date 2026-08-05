// Extrai o CSS do index.html e escopa todos os seletores sob #tenant-site
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
if (!styleMatch) {
  console.error("style nao encontrado");
  process.exit(1);
}
let css = styleMatch[1];
css = css.replace(/\/\*[\s\S]*?\*\//g, ""); // remove comentarios

function mapSelector(sel) {
  const s = sel.trim();
  if (!s) return s;
  // regras globais que precisam ser mapeadas para o container do tenant
  if (s === ":root") return ":root";
  if (s === "body" || s === "html") return "#tenant-site";
  if (s === "body::before" || s === "body::after") return "#tenant-site::before".replace("::before", s.includes("before") ? "::before" : "::after");
  if (s === "html") return "#tenant-site";
  if (s === "*") return "#tenant-site *";
  return "#tenant-site " + s;
}

function prefixCss(css) {
  let out = "";
  let i = 0;
  const n = css.length;

  while (i < n) {
    const ch = css[i];
    if (ch === "@") {
      let j = css.indexOf("{", i);
      if (j === -1) {
        out += css.slice(i);
        break;
      }
      const header = css.slice(i, j).trim();
      let depth = 1;
      let k = j + 1;
      while (k < n && depth > 0) {
        if (css[k] === "{") depth++;
        else if (css[k] === "}") depth--;
        k++;
      }
      const inner = css.slice(j + 1, k - 1);
      if (/^@keyframes|^@font-face|^@import|^@charset|^@supports|^@page/.test(header)) {
        out += header + " {" + inner + "}\n";
      } else if (/^@media/.test(header)) {
        out += header + " {" + prefixCss(inner) + "}\n";
      } else {
        out += header + " {" + prefixCss(inner) + "}\n";
      }
      i = k;
      continue;
    }
    if (ch === "}" || ch === "\n" || ch === " ") {
      out += ch;
      i++;
      continue;
    }
    let j = css.indexOf("{", i);
    if (j === -1) break;
    let selector = css.slice(i, j);
    let depth = 1;
    let k = j + 1;
    while (k < n && depth > 0) {
      if (css[k] === "{") depth++;
      else if (css[k] === "}") depth--;
      k++;
    }
    const body = css.slice(j + 1, k - 1);
    const prefixed = selector
      .split(",")
      .map(mapSelector)
      .join(", ");
    out += prefixed + " {" + body + "}\n";
    i = k;
  }
  return out;
}

const scoped = prefixCss(css);
fs.writeFileSync(path.join(__dirname, "..", "app", "(site)", "site.css"), scoped, "utf8");
console.log("site.css gerado com", scoped.length, "bytes");
