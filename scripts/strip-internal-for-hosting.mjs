/**
 * Удаляет служебные каталоги из артефакта деплоя (Timeweb).
 * Исходники остаются в private GitHub; на публичном диске /docs и /ops не раздаются.
 */
import { rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const targets = ['docs', 'ops'];

for (const name of targets) {
  const dir = join(root, name);
  if (!existsSync(dir)) {
    console.log(`[strip] skip missing: ${name}/`);
    continue;
  }
  rmSync(dir, { recursive: true, force: true });
  console.log(`[strip] removed: ${name}/`);
}

console.log('[strip] hosting artifact ready (docs/ and ops/ not published)');
