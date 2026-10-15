export const usd = (cents: number, locale = 'en-US') =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(cents / 100);
