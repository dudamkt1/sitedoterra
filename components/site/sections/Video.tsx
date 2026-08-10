export interface VideoContent {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  videoUrl?: string | null;
  thumbLabel?: string;
  playLabel?: string;
}

function embedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return url;
}

export function Video({ content }: { content: VideoContent }) {
  const src = embedUrl(content.videoUrl);
  return (
    <section id="video">
      <div className="reveal">
        <div className="section-eyebrow"><span className="eyebrow-line"></span><span className="eyebrow-text">{content.eyebrow || "Assista agora"}</span></div>
        <h2 className="section-title">{content.title || "Conteúdo em vídeo"}</h2>
        {content.subtitle && <p className="section-sub">{content.subtitle}</p>}
      </div>
      <div className="video-frame reveal" style={{ transitionDelay: "0.2s" }}>
        {src ? (
          <iframe
            className="video-embed"
            src={src}
            title={content.title || "Vídeo"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="video-thumb">
            <div className="video-play-btn"><div className="video-play-icon"></div></div>
            {content.thumbLabel && <span className="video-label">{content.thumbLabel}</span>}
          </div>
        )}
      </div>
    </section>
  );
}
