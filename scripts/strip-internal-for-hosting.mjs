/**
 * Собирает публичный каталог dist/ для Timeweb (HTML/CSS/JS).
 * В dist не попадают: docs, ops, operator-docs, operator-ops и прочие служебные пути.
 * Исходники остаются в private GitHub; на публичном диске их нет.
 */
import {
  rmSync,
  existsSync,
  mkdirSync,
  cpSync,
  readdirSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const skipNames = new Set([
  '.git',
  '.github',
  '.env',
  'dist',
  'docs',
  'ops',
  'operator-docs',
  'operator-ops',
  'scripts',
  'tests',
  'node_modules',
  'package.json',
  'package-lock.json',
  'Caddyfile',
  'app.py',
  'script.txt',
  '_kw-live.txt',
  '_kw-report.txt',
  'images.lnk',
  '.env.example',
  '.gitignore'
]);

function shouldSkip(name) {
  if (skipNames.has(name)) return true;
  if (name.startsWith('_kw-')) return true;
  if (name.endsWith('.lnk')) return true;
  // Случайные файлы в корне репозитория не публикуем
  if (/\.(jpg|jpeg|png|gif|webp|txt|py|ps1)$/i.test(name) && !['robots.txt', 'sitemap.xml'].includes(name)) {
    return true;
  }
  return false;
}

if (existsSync(dist)) {
  rmSync(dist, { recursive: true, force: true });
}
mkdirSync(dist, { recursive: true });

for (const name of readdirSync(root)) {
  if (shouldSkip(name)) {
    console.log(`[build] skip: ${name}`);
    continue;
  }
  const from = join(root, name);
  const to = join(dist, name);
  const st = statSync(from);
  if (st.isDirectory()) {
    cpSync(from, to, { recursive: true });
    console.log(`[build] copy dir: ${name}/`);
  } else {
    cpSync(from, to);
    console.log(`[build] copy: ${name}`);
  }
}

writeFileSync(
  join(dist, '.build-stamp'),
  `studia-mai public artifact\nbuilt=${new Date().toISOString()}\nexcluded=docs,ops,operator-docs,operator-ops\n`,
  'utf8'
);

console.log('[build] dist/ ready — without docs/, ops/, operator-docs/, operator-ops/');
