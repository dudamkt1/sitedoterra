"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface VideoContent {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  videoUrl?: string | null;
  thumbLabel?: string;
  playLabel?: string;
}

type Provider = "youtube" | "vimeo" | "file";

function parseSource(url: string | null | undefined): { provider: Provider; id: string; embed: string; watch: string } | null {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) {
    return {
      provider: "youtube",
      id: yt[1],
      embed: `https://www.youtube.com/embed/${yt[1]}?autoplay=1&rel=0`,
      watch: `https://www.youtube.com/watch?v=${yt[1]}`,
    };
  }
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) {
    return {
      provider: "vimeo",
      id: vimeo[1],
      embed: `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1`,
      watch: `https://vimeo.com/${vimeo[1]}`,
    };
  }
  return { provider: "file", id: url, embed: url, watch: url };
}

function requestContainerFullscreen(el: HTMLElement | null) {
  if (!el) return;
  const anyEl = el as HTMLElement & {
    webkitRequestFullscreen?: () => void;
    msRequestFullscreen?: () => void;
  };
  if (el.requestFullscreen) {
    el.requestFullscreen().catch(() => {});
  } else if (anyEl.webkitRequestFullscreen) {
    anyEl.webkitRequestFullscreen();
  } else if (anyEl.msRequestFullscreen) {
    anyEl.msRequestFullscreen();
  }
}

/**
 * Capa do vídeo = PRIMEIRO FRAME como fundo:
 * - YouTube: thumbnail oficial em alta (maxres → hq como fallback);
 * - Vimeo: thumbnail via oEmbed (best-effort, cai no degradê);
 * - Arquivo direto (MP4): o próprio <video> com preload de metadados exibe
 *   o primeiro frame nativamente.
 * Ao centro, nítido: selo opcional + botão de play + "REPRODUZIR VÍDEO".
 */
function VideoPoster({ src }: { src: NonNullable<ReturnType<typeof parseSource>> }) {
  const [ytFallback, setYtFallback] = useState(false);
  const [vimeoThumb, setVimeoThumb] = useState<string | null>(null);

  useEffect(() => {
    if (src.provider !== "vimeo") return;
    let alive = true;
    fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(src.watch)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const thumb = j?.thumbnail_url ? String(j.thumbnail_url) : null;
        if (alive && thumb) setVimeoThumb(thumb);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [src]);

  if (src.provider === "youtube") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="video-poster"
        src={ytFallback ? `https://i.ytimg.com/vi/${src.id}/hqdefault.jpg` : `https://i.ytimg.com/vi/${src.id}/maxresdefault.jpg`}
        alt=""
        aria-hidden
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setYtFallback(true)}
      />
    );
  }
  if (src.provider === "vimeo" && vimeoThumb) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img className="video-poster" src={vimeoThumb} alt="" aria-hidden loading="lazy" referrerPolicy="no-referrer" />
    );
  }
  if (src.provider === "file") {
    return (
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <video className="video-poster" src={src.embed} muted playsInline preload="metadata" aria-hidden tabIndex={-1} />
    );
  }
  return null;
}

/**
 * Seção de vídeo com lightbox: o quadro exibe a capa com botão de play;
 * ao tocar, o vídeo abre CENTRALIZADO na janela (inclusive no mobile), com
 * ações de tela cheia e "ver no YouTube". Ao fechar, a página volta
 * EXATAMENTE para a posição onde estava (scroll restaurado).
 */
export function Video({ content }: { content: VideoContent }) {
  const src = parseSource(content.videoUrl);
  const [open, setOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const scrollYRef = useRef(0);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  // Trava o scroll do fundo ao abrir; ao fechar, restaura a posição exata.
  useEffect(() => {
    if (!open) return;
    scrollYRef.current = window.scrollY;
    const prevOverflow = document.body.style.overflow;
    const prevPosition = document.body.style.position;
    const prevTop = document.body.style.top;
    document.body.style.overflow = "hidden";
    // Trava iOS (que ignora overflow em alguns casos).
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollYRef.current}px`;
    document.body.style.width = "100%";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.position = prevPosition;
      document.body.style.top = prevTop;
      document.body.style.width = "";
      window.scrollTo(0, scrollYRef.current);
    };
  }, [open ]);

  // Fecha com ESC + acompanha estado de tela cheia.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const doc = document as Document & { webkitFullscreenElement?: Element };
        if (document.fullscreenElement || doc.webkitFullscreenElement) return;
        close();
      }
    };
    const onFs = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element };
      setIsFullscreen(Boolean(document.fullscreenElement || doc.webkitFullscreenElement));
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, [open, close]);

  return (
    <section id="video">
      <div className="reveal">
        <div className="section-eyebrow"><span className="eyebrow-line"></span><span className="eyebrow-text">{content.eyebrow || "Assista agora"}</span></div>
        <h2 className="section-title">{content.title || "Conteúdo em vídeo"}</h2>
        {content.subtitle && <p className="section-sub">{content.subtitle}</p>}
      </div>
      <div className="video-frame-wrap">
        <button
          type="button"
          className="video-frame reveal"
          style={{ transitionDelay: "0.2s" }}
          onClick={() => src && setOpen(true)}
          disabled={!src}
          aria-label={src ? `Assistir: ${content.title || "vídeo"}` : content.thumbLabel || "Vídeo em breve"}
        >
          <span className="video-thumb">
            {src && <VideoPoster src={src} />}
            <span className="video-scrim" aria-hidden />
            <span className="video-cta">
              {content.thumbLabel && <span className="video-kicker">{content.thumbLabel}</span>}
              <span className="video-play-btn"><span className="video-play-icon" /></span>
              <span className="video-cta-label">{content.playLabel || "REPRODUZIR VÍDEO"}</span>
            </span>
          </span>
        </button>
      </div>

      {open && src && (
        <div
          className="video-modal"
          role="dialog"
          aria-modal="true"
          aria-label={content.title || "Vídeo"}
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="video-modal-box" ref={boxRef}>
            <div className="video-modal-bar">
              <span className="video-modal-title">{content.title || "Vídeo"}</span>
              <button type="button" className="video-modal-btn" onClick={close} aria-label="Fechar vídeo">
                ✕
              </button>
            </div>
            <div className="video-modal-player">
              {src.provider === "file" ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video
                  className="video-embed"
                  src={src.embed}
                  controls
                  autoPlay
                  playsInline
                  preload="metadata"
                />
              ) : (
                <iframe
                  className="video-embed"
                  src={src.embed}
                  title={content.title || "Vídeo"}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>
            <div className="video-modal-actions">
              <button
                type="button"
                className="video-modal-btn video-modal-action"
                onClick={() => requestContainerFullscreen(boxRef.current)}
              >
                {isFullscreen ? "⤢ Sair da tela cheia" : "⛶ Ver em tela cheia"}
              </button>
              <a
                className="video-modal-btn video-modal-action"
                href={src.watch}
                target="_blank"
                rel="noopener noreferrer"
              >
                {src.provider === "youtube" ? "▶ Ver no YouTube" : src.provider === "vimeo" ? "▶ Ver no Vimeo" : "↗ Abrir vídeo"}
              </a>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
