// Concatenates tokens + component CSS into dist/styles.css and ships tokens.json.
import { copyFileSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const p = (rel) => fileURLToPath(new URL(`../${rel}`, import.meta.url));
mkdirSync(p('dist'), { recursive: true });
const css = ['src/styles/tokens.css', 'src/styles/components.css'].map((f) => readFileSync(p(f), 'utf8')).join('\n');
writeFileSync(p('dist/styles.css'), css);
copyFileSync(p('tokens/tokens.json'), p('dist/tokens.json'));
console.log(`dist/styles.css ${css.length} bytes`);
