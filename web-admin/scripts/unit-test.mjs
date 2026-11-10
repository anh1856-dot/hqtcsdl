import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
function find(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? find(join(directory, entry.name))
      : entry.name.endsWith('.test.mjs')
        ? [join(directory, entry.name)]
        : [],
  );
}
process.exit(
  spawnSync(process.execPath, ['--test', ...find('src')], { stdio: 'inherit' })
    .status ?? 1,
);
