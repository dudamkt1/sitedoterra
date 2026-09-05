// Geração de variantes de ícone PWA a partir de uma imagem fonte.
//
// Requisitos:
// - Aceitar PNG/JPG/WebP/SVG (decodificável pelo browser).
// - Aceitar imagens NÃO quadradas (composição inteligente: mantém proporção
//   e adiciona padding do background_color do PWA — sem distorcer).
// - Gerar PNGs OPACOS para Android (Chrome prefere opaco; transparente
//   vira "fantasma" cinza na tela inicial).
// - Preservar transparência APENAS onde apropriado (apple-touch-icon
//   iOS aceita transparência; Android não).
// - Máscara maskable: padding de 10% em cada lado (safe zone 80%).
// - Sempre gerar arquivos reais (PNG bytes), nunca depender do arquivo
//   original no manifest.

export type BgMode = "solid" | "theme" | "transparent";

export interface IconVariantsOptions {
  /** Cor de fundo principal (theme_color do PWA). Usada para compor padding em logos retangulares. */
  themeColor: string;
  /** Cor de fundo do app (background_color). Usada como cor de composição mais neutra. */
  backgroundColor: string;
  /** Modo de fundo padrão para os PNGs "any" (sem máscara). Padrão: "theme" (sólido, opaco). */
  anyMode?: BgMode;
}

const DEFAULT_OPTIONS: Required<Pick<IconVariantsOptions, "themeColor" | "backgroundColor" | "anyMode">> = {
  themeColor: "#1d5c3a",
  backgroundColor: "#faf8f2",
  anyMode: "theme",
};

export interface IconVariantsResult {
  icon_180: Blob;
  icon_192: Blob;
  icon_512: Blob;
  icon_maskable_512: Blob;
}

/** Lê uma imagem (File ou Blob) e devolve ImageBitmap. Erros são lançados. */
export async function decodeImage(source: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(source);
  } catch {
    // Fallback: alguns browsers móveis têm problemas com createImageBitmap(blob)
    // para certos formatos (ex.: JPG progressivo). Carrega via <img> + createImageBitmap(img).
    const url = URL.createObjectURL(source);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () =>
          reject(
            new Error(
              "Não foi possível decodificar a imagem. Use PNG (com ou sem fundo), JPG ou WebP, de preferência 512×512px ou maior."
            )
          );
        i.src = url;
      });
      return await createImageBitmap(img);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function makeCanvas(size: number): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas 2D não disponível neste navegador.");
  return { canvas, ctx };
}

function blobToCanvas(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Falha ao carregar a imagem para composição."));
    };
    img.src = url;
  });
}

/**
 * Desenha a imagem centralizada em um canvas quadrado, mantendo proporção.
 * Preenche o fundo (cor sólida) ANTES de desenhar — o PNG resultante é OPAÇO.
 * Imagens não-quadradas recebem letterbox (padding) sem distorção.
 */
async function drawComposedSquare(
  source: HTMLImageElement | ImageBitmap,
  size: number,
  bgColor: string,
  opacity: "opaque" | "preserve"
): Promise<Blob> {
  const { canvas, ctx } = makeCanvas(size);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // 1) Fundo OPAÇO (essencial para Android — ícone transparente fica "fantasma").
  ctx.fillStyle = bgColor || "#1d5c3a";
  ctx.fillRect(0, 0, size, size);

  // 2) Calcular retângulo interno que mantém proporção 1:1 sem cortar.
  const srcW = "naturalWidth" in source ? source.naturalWidth : source.width;
  const srcH = "naturalHeight" in source ? source.naturalHeight : source.height;
  const ratio = Math.min(size / srcW, size / srcH);
  const drawW = Math.round(srcW * ratio);
  const drawH = Math.round(srcH * ratio);
  const dx = Math.floor((size - drawW) / 2);
  const dy = Math.floor((size - drawH) / 2);

  ctx.drawImage(source, dx, dy, drawW, drawH);

  // 3) PNG sempre opaco (alfa desligado no makeCanvas) — exceto se preservar para iOS.
  const type = "image/png";
  return await canvasToBlob(canvas, type);
}

/** Maskable: padding 10% (safe zone 80%). Fundo OPAÇO obrigatório (Android corta em squircle). */
async function drawMaskable(
  source: HTMLImageElement | ImageBitmap,
  size: number,
  bgColor: string
): Promise<Blob> {
  const { canvas, ctx } = makeCanvas(size);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Fundo opaco.
  ctx.fillStyle = bgColor || "#1d5c3a";
  ctx.fillRect(0, 0, size, size);

  // Conteúdo em 80% do canvas (10% padding de cada lado).
  const safe = Math.round(size * 0.8);
  const dx = Math.floor((size - safe) / 2);
  const dy = dx;

  const srcW = "naturalWidth" in source ? source.naturalWidth : source.width;
  const srcH = "naturalHeight" in source ? source.naturalHeight : source.height;
  const ratio = Math.min(safe / srcW, safe / srcH);
  const drawW = Math.round(srcW * ratio);
  const drawH = Math.round(srcH * ratio);
  const ix = dx + Math.floor((safe - drawW) / 2);
  const iy = dy + Math.floor((safe - drawH) / 2);

  ctx.drawImage(source, ix, iy, drawW, drawH);

  return await canvasToBlob(canvas, "image/png");
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao codificar a imagem (canvas.toBlob devolveu null)."))),
      type
    );
  });
}

/**
 * Gera as 4 variantes oficiais do PWA a partir de uma imagem fonte.
 *
 * Estratégia:
 * - icon_180 (apple-touch): opaco, fundo = theme_color (iOS aceita transparente,
 *   mas opaco fica melhor quando a home screen é clara).
 * - icon_192 (Android legacy): opaco, fundo = theme_color.
 * - icon_512 (Android splash/home): opaco, fundo = theme_color.
 * - icon_maskable_512: opaco, fundo = theme_color, conteúdo em safe zone 80%.
 *
 * Imagens retangulares são COMPOSTAS com padding (não distorcidas).
 * Imagens transparentes ficam visíveis porque o fundo é sempre opaco.
 *
 * @param sourceBlob Arquivo original (File/Blob).
 * @param options Cores do PWA e modos de composição.
 */
export async function generateIconVariants(
  sourceBlob: Blob,
  options: IconVariantsOptions
): Promise<IconVariantsResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const img = await blobToCanvas(sourceBlob);

  // Fundo padrão: theme_color (mais "vivo" e consistente com a marca).
  // Para casos onde a logo já é quadrada e "com fundo", o fundo fica
  // uniforme e o Android mostra bem.
  const anyBg = opts.anyMode === "solid" ? opts.backgroundColor : opts.themeColor;

  const [icon_180, icon_192, icon_512, icon_maskable_512] = await Promise.all([
    drawComposedSquare(img, 180, anyBg, "opaque"),
    drawComposedSquare(img, 192, anyBg, "opaque"),
    drawComposedSquare(img, 512, anyBg, "opaque"),
    drawMaskable(img, 512, opts.themeColor),
  ]);

  return { icon_180, icon_192, icon_512, icon_maskable_512 };
}
