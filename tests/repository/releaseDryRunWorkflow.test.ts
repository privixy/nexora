import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const workflow = readFileSync(resolve(repoRoot, '.github/workflows/release-dry-run.yml'), 'utf8');

describe('release dry run workflow', () => {
  it('disables updater artifact signing for dry-run Tauri bundles', () => {
    const buildArgs = workflow
      .split('\n')
      .filter((line) => line.trim().startsWith("args: '"))
      .map((line) => line.trim());

    expect(buildArgs).toHaveLength(3);
    expect(buildArgs).toEqual([
      'args: \'--target universal-apple-darwin --bundles dmg --config {"bundle":{"createUpdaterArtifacts":false}}\'',
      'args: \'--bundles deb --config {"bundle":{"createUpdaterArtifacts":false}}\'',
      'args: \'--bundles nsis --config {"bundle":{"createUpdaterArtifacts":false}}\'',
    ]);
  });
});
