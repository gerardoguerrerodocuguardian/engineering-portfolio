import { darkPalette, lightPalette, paletteFor } from './theme';

describe('paletteFor', () => {
  it('maps color schemes to palettes', () => {
    expect(paletteFor('dark')).toBe(darkPalette);
    expect(paletteFor('light')).toBe(lightPalette);
    expect(paletteFor(null)).toBe(lightPalette);
  });
});
