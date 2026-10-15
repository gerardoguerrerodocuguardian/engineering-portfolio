import { readFileSync } from 'node:fs';
import tokens from '../tokens/tokens.json';

type Theme = Record<string, string>;
const themes = tokens.themes as Record<string, Theme>;

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

// [foreground token, background token, minimum ratio]
const textPairs: Array<[string, string]> = [
  ['fg', 'bg'], ['fg', 'surface'], ['fg-muted', 'bg'], ['fg-muted', 'surface'], ['primary-fg', 'primary'], ['primary-fg', 'primary-hover'],
  ['danger-fg', 'danger'], ['danger-fg', 'danger-hover'], ['neutral-fg', 'neutral-bg'], ['success-fg', 'success-bg'], ['warning-fg', 'warning-bg'],
  ['info-fg', 'info-bg'], ['danger-text', 'danger-bg'], ['danger-text', 'bg'], ['fg', 'surface-raised'],
];
const uiPairs: Array<[string, string]> = [['border', 'bg'], ['focus', 'bg'], ['primary', 'bg']];

describe('design tokens', () => {
  it('defines the same keys in every theme', () => {
    const keys = Object.keys(themes.light!).sort();
    for (const theme of Object.values(themes)) expect(Object.keys(theme).sort()).toEqual(keys);
  });

  describe.each(Object.keys(themes))('%s theme', (name) => {
    const theme = themes[name]!;
    it.each(textPairs)('text %s on %s meets WCAG AA (4.5:1)', (fg, bg) => {
      expect(contrast(theme[fg]!, theme[bg]!)).toBeGreaterThanOrEqual(name === 'high-contrast' ? 7 : 4.5);
    });
    it.each(uiPairs)('UI colour %s on %s meets 3:1', (fg, bg) => {
      expect(contrast(theme[fg]!, theme[bg]!)).toBeGreaterThanOrEqual(3);
    });
  });

  it('generated CSS is in sync with tokens.json', () => {
    const css = readFileSync('src/styles/tokens.css', 'utf8');
    for (const [name, theme] of Object.entries(themes)) {
      expect(css).toContain(`[data-theme="${name}"]`);
      expect(css).toContain(`--adf-color-primary: ${theme.primary};`);
    }
    expect(css).toContain('prefers-reduced-motion');
  });
});
