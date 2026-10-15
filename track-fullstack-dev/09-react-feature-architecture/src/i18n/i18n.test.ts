import { describe, expect, it } from 'vitest';
import { en } from './en';
import { es } from './es';
import { translate } from './index';

describe('i18n', () => {
  it('interpolates variables', () => {
    expect(translate('en', 'campaigns.page', { page: 2, pages: 4 })).toBe('Page 2 of 4');
    expect(translate('es', 'campaigns.page', { page: 2, pages: 4 })).toBe('Página 2 de 4');
  });
  it('has the same keys and placeholders in en and es', () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const k of Object.keys(en) as (keyof typeof en)[]) expect(ph(es[k])).toEqual(ph(en[k]));
  });
});
