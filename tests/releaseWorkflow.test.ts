import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workflow = readFileSync(resolve(repoRoot, '.github/workflows/release.yml'), 'utf8');

describe('release workflow', () => {
  it('passes workflow_dispatch tag input into github-script without core.getInput', () => {
    expect(workflow).toContain("? '${{ inputs.tag }}'");
    expect(workflow).not.toContain("core.getInput('tag'");
  });
});
