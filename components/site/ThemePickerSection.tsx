"use client";

import { useEffect, useState } from "react";
import {
  THEME_PRESETS,
  paletteToVars,
  visitorThemeStorageKey,
} from "@/lib/site-theme";

interface ThemePickerSectionProps {
  slug: string;
}

/**
 * Seção da HOME onde o VISITANTE experimenta combinações de cores do site.
 * A escolha fica salva apenas no navegador/celular dele (localStorage) —
 * é uma amostra de que o site pode ter a cor que ele quiser.
 * O tema padrão do site é definido separadamente pelo dono em /painel/meu-site.
 */
export function ThemePickerSection({ slug }: ThemePickerSectionProps) {
  const [active, setActive] = useState<string | null>(null);

  // Aplica (e marca como ativa) a cor salva neste navegador.
  useEffect(() => {
    let key: string | null = null;
    try {
      key = localStorage.getItem(visitorThemeStorageKey(slug));
    } catch {}
    if (!key) return;
    const preset = THEME_PRESETS.find((p) => p.key === key);
    if (!preset) return;
    applyPresetVars(preset.key);
    setActive(preset.key);
  }, [slug]);

  function applyPresetVars(key: string) {
    const preset = THEME_PRESETS.find((p) => p.key === key);
    if (!preset) return;
    const el = document.getElementById("tenant-site");
    if (!el) return;
    for (const [name, value] of Object.entries(paletteToVars(preset.palette))) {
      el.style.setProperty(name, value);
    }
    // Cor do navegador acompanha a escolha do visitante.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", preset.palette.main);
  }

  function choose(key: string) {
    applyPresetVars(key);
    setActive(key);
    try {
      localStorage.setItem(visitorThemeStorageKey(slug), key);
    } catch {}
  }

  function reset() {
    const el = document.getElementById("tenant-site");
    if (el) {
      for (const name of Object.keys(paletteToVars(THEME_PRESETS[0].palette))) {
        el.style.removeProperty(name);
      }
    }
    try {
      localStorage.removeItem(visitorThemeStorageKey(slug));
    } catch {}
    setActive(null);
  }

  return (
    <section id="tema">
      <div className="tema-inner">
        <div className="tema-head reveal">
          <div className="section-eyebrow">
            <span className="eyebrow-line"></span>
            <span className="eyebrow-text">Personalize sua experiência</span>
          </div>
          <h2 className="section-title">
            Escolha a <em>cor do site</em>
          </h2>
          <p className="tema-sub">
            Toque em uma cor e veja o site inteiro mudar na hora. Fica salvo só no seu
            navegador — é uma amostra de como este site pode ficar com a sua cara.
          </p>
        </div>

        <div className="tema-swatches reveal">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              className={"tema-swatch" + (active === preset.key ? " active" : "")}
              onClick={() => choose(preset.key)}
              aria-pressed={active === preset.key}
            >
              <span
                className="tema-ball"
                style={{
                  background: `linear-gradient(135deg, ${preset.palette.main} 0%, ${preset.palette.medium} 60%, ${preset.palette.light} 100%)`,
                }}
              >
                {active === preset.key && <span className="tema-check">✓</span>}
              </span>
              <span className="tema-name">{preset.label}</span>
              <span className="tema-desc">{preset.description}</span>
            </button>
          ))}
        </div>

        <div className="tema-footer reveal">
          {active ? (
            <button type="button" className="tema-reset" onClick={reset}>
              ↺ Restaurar cor padrão do site
            </button>
          ) : (
            <p className="tema-hint">✨ Esta é a cor padrão — toque em uma das opções acima para testar outra.</p>
          )}
        </div>
      </div>
    </section>
  );
}
