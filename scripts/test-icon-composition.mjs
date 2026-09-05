// Testa a lógica PURA de composição de ícones (cálculo de posição/proporção),
// sem precisar de Canvas real. O Canvas real é testado no browser.

function computeDrawRect(srcW, srcH, dstSize) {
  const ratio = Math.min(dstSize / srcW, dstSize / srcH);
  const drawW = Math.round(srcW * ratio);
  const drawH = Math.round(srcH * ratio);
  const dx = Math.floor((dstSize - drawW) / 2);
  const dy = Math.floor((dstSize - drawH) / 2);
  return { drawW, drawH, dx, dy };
}

function computeMaskableRect(srcW, srcH, dstSize) {
  const safe = Math.round(dstSize * 0.8);
  const pad = Math.floor((dstSize - safe) / 2);
  const ratio = Math.min(safe / srcW, safe / srcH);
  const drawW = Math.round(srcW * ratio);
  const drawH = Math.round(srcH * ratio);
  const ix = pad + Math.floor((safe - drawW) / 2);
  const iy = pad + Math.floor((safe - drawH) / 2);
  return { drawW, drawH, ix, iy, safe, pad };
}

let failures = 0;
function assert(cond, msg) {
  if (cond) console.log("✓", msg);
  else { console.error("✗", msg); failures++; }
}

// 1) Imagem QUADRADA 512x512 → preenche todo o canvas 512x512
{
  const r = computeDrawRect(512, 512, 512);
  assert(r.drawW === 512, "quadrado: drawW = 512");
  assert(r.drawH === 512, "quadrado: drawH = 512");
  assert(r.dx === 0 && r.dy === 0, "quadrado: dx=dy=0");
}

// 2) Imagem RETANGULAR 1024x256 (4:1) em canvas 512x512 → vira letterbox horizontal
{
  const r = computeDrawRect(1024, 256, 512);
  assert(r.drawW === 512, "1024x256→512: drawW = 512");
  assert(r.drawH === 128, "1024x256→512: drawH = 128");
  assert(r.dx === 0, "1024x256→512: dx = 0 (preenche largura)");
  assert(r.dy === 192, "1024x256→512: dy = (512-128)/2 = 192");
}

// 3) Imagem RETANGULAR 256x1024 (1:4) em canvas 512x512 → letterbox vertical
{
  const r = computeDrawRect(256, 1024, 512);
  assert(r.drawW === 128, "256x1024→512: drawW = 128");
  assert(r.drawH === 512, "256x1024→512: drawH = 512");
  assert(r.dx === 192, "256x1024→512: dx = 192");
  assert(r.dy === 0, "256x1024→512: dy = 0");
}

// 4) Imagem 600x600 em canvas 512 → downscale preservando aspect
{
  const r = computeDrawRect(600, 600, 512);
  assert(r.drawW === 512, "600x600→512: drawW = 512");
  assert(r.drawH === 512, "600x600→512: drawH = 512");
  assert(r.dx === 0 && r.dy === 0, "600x600→512: centralizado");
}

// 5) Maskable: imagem 1024x1024 em canvas 512 → safe zone 80% = 410px
{
  const m = computeMaskableRect(1024, 1024, 512);
  assert(m.safe === 410, `maskable 1024x1024: safe = 410 (${m.safe})`);
  assert(m.pad === 51, `maskable 1024x1024: pad = 51 (${m.pad})`);
  assert(m.drawW === 410, `maskable 1024x1024: drawW = 410`);
  assert(m.drawH === 410, `maskable 1024x1024: drawH = 410`);
  assert(m.ix === 51 && m.iy === 51, "maskable 1024x1024: ix=iy=51");
}

// 6) Maskable: imagem retangular 2048x512 (4:1) em canvas 512
{
  const m = computeMaskableRect(2048, 512, 512);
  // safe=410, ratio = min(410/2048, 410/512) = min(0.2, 0.8) = 0.2
  // drawW = 2048*0.2 = 410, drawH = 512*0.2 = 102
  assert(m.drawW === 410, `maskable 2048x512: drawW = 410`);
  assert(Math.abs(m.drawH - 102) <= 1, `maskable 2048x512: drawH ≈ 102 (${m.drawH})`);
}

// 7) Maskable: imagem 192x192 (mínimo Android legacy) em canvas 512
{
  const m = computeMaskableRect(192, 192, 512);
  // safe=410, ratio = min(410/192, 410/192) = 410/192 ≈ 2.135
  // drawW = drawH = 192*2.135 ≈ 410
  assert(Math.abs(m.drawW - 410) <= 1, `maskable 192x192: drawW ≈ 410 (${m.drawW})`);
}

if (failures > 0) {
  console.error(`\nFALHOU (${failures})`);
  process.exit(1);
} else {
  console.log("\nOK — lógica de composição válida para:");
  console.log("  - Imagens quadradas");
  console.log("  - Imagens retangulares (landscape/portrait)");
  console.log("  - Maskable com safe zone 80%");
}
