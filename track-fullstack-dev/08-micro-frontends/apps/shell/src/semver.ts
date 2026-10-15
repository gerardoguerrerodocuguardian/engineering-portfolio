type V = [number, number, number];
const parse = (v: string): V | null => {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v.trim().replace(/^[v=]/, ''));
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};
const cmp = (a: V, b: V) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** Tiny subset of semver ranges: exact, ^x.y.z, ~x.y.z, >=x.y.z, and "*". Enough for shared-dep skew checks. */
export function satisfies(version: string, range: string): boolean {
  const v = parse(version);
  if (range.trim() === '*') return true;
  const r = parse(range.replace(/^[\^~>=\s]+/, ''));
  if (!v || !r) return false;
  const op = range.trim()[0] === '^' ? '^' : range.trim()[0] === '~' ? '~' : range.trim().startsWith('>=') ? '>=' : '=';
  if (op === '=') return cmp(v, r) === 0;
  if (op === '>=') return cmp(v, r) >= 0;
  if (cmp(v, r) < 0) return false;
  if (op === '~') return v[0] === r[0] && v[1] === r[1];
  if (r[0] > 0) return v[0] === r[0];
  if (r[1] > 0) return v[0] === 0 && v[1] === r[1];
  return v[0] === 0 && v[1] === 0 && v[2] === r[2];
}
