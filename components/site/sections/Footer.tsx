interface SocialConfig {
  whatsapp?: boolean;
  instagram?: boolean | { enabled?: boolean; url?: string };
  facebook?: boolean | { enabled?: boolean; url?: string };
  youtube?: boolean | { enabled?: boolean; url?: string };
}

export interface FooterContent {
  aboutText?: string;
  social?: SocialConfig;
  showPlatformCredit?: boolean;
  _contactWhatsapp?: string;
  _contactEmail?: string;
  _contactInstagram?: string;
  _profileName?: string;
}

export interface FooterProps {
  content: FooterContent;
  navItems: { label: string; href: string }[];
  contactWhatsapp?: string;
  contactEmail?: string;
  contactInstagram?: string;
  profileName?: string;
}

interface SocialItem {
  enabled: boolean;
  url: string;
}

function normalizeSocialItem(value: boolean | { enabled?: boolean; url?: string } | undefined, fallbackUrl: string): SocialItem {
  if (value && typeof value === "object") {
    const url = typeof value.url === "string" && value.url.trim() ? value.url.trim() : fallbackUrl;
    return { enabled: value.enabled !== false && !!url && url !== "#", url };
  }
  return { enabled: value !== false && !!fallbackUrl && fallbackUrl !== "#", url: fallbackUrl };
}

export function Footer({ content, navItems, contactWhatsapp, contactEmail, contactInstagram, profileName }: FooterProps) {
  const social = content.social || {};
  const whatsapp = contactWhatsapp || content._contactWhatsapp || "5511999999999";
  const wppLink = `https://wa.me/${whatsapp}`;
  const email = contactEmail || content._contactEmail || "contato@email.com";
  const instaUrl = contactInstagram || content._contactInstagram || "";
  const fullName = profileName || content._profileName || "Nome do profissional";
  const year = new Date().getFullYear();

  const instagram = normalizeSocialItem(social.instagram, instaUrl);
  const facebook = normalizeSocialItem(social.facebook, "");
  const youtube = normalizeSocialItem(social.youtube, "");
  const socialLinks = [
    { key: "instagram", label: "Instagram", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z" /></svg>, item: instagram },
    { key: "facebook", label: "Facebook", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>, item: facebook },
    { key: "youtube", label: "YouTube", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z" /></svg>, item: youtube },
  ].filter((s) => s.item.enabled);

  return (
    <footer>
      <div className="footer-top">
        <div className="footer-brand">
          <span className="footer-logo">{fullName}</span>
          <p>{content.aboutText}</p>
          <div className="footer-socials">
            {social.whatsapp !== false && (
              <a href={wppLink} target="_blank" rel="noopener noreferrer" className="footer-social" title="WhatsApp">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.133.558 4.135 1.535 5.875L0 24l6.29-1.503A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg>
              </a>
            )}
            {socialLinks.map((s) => (
              <a key={s.key} href={s.item.url} target="_blank" rel="noopener noreferrer" className="footer-social" title={s.label}>
                {s.icon}
              </a>
            ))}
          </div>
        </div>
        <div className="footer-links">
          <h4>Navegação</h4>
          <ul>
            {navItems.map((item) => <li key={item.href}><a href={item.href}>{item.label}</a></li>)}
          </ul>
        </div>
        <div className="footer-links">
          <h4>Contato</h4>
          <ul>
            <li><a href={wppLink} target="_blank" rel="noopener noreferrer">WhatsApp</a></li>
            <li><a href={`mailto:${email}`}>E-mail</a></li>
            {socialLinks.map((s) => (
              <li key={s.key}><a href={s.item.url} target="_blank" rel="noopener noreferrer">{s.label}</a></li>
            ))}
          </ul>
        </div>
        <div className="footer-links">
          <h4>Legal</h4>
          <ul>
            <li><a href="#">Política de Privacidade</a></li>
            <li><a href="#">Termos de Uso</a></li>
            <li><a href="#">Cookies</a></li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <p className="footer-copy">© {year} {fullName} {content.showPlatformCredit ? "| Feito com ♥ pela TopConsultores" : ""}</p>
        <p className="footer-copy">Consultora Independente doTERRA — as opiniões expressas são pessoais e não representam a doTERRA International.</p>
      </div>
    </footer>
  );
}
