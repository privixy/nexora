import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const workflow = readFileSync(resolve(repoRoot, '.github/workflows/release.yml'), 'utf8');

describe('release workflow', () => {
  it('passes workflow_dispatch tag input into github-script without core.getInput', () => {
    expect(workflow).toContain("? '${{ inputs.tag }}'");
    expect(workflow).not.toContain("core.getInput('tag'");
  });

  it('checks out and releases an existing exact tag instead of the dispatch commit', () => {
    expect(workflow).toContain("ref: ${{ github.event_name == 'workflow_dispatch' && inputs.tag || github.ref }}");
    expect(workflow).toContain("git.getRef({ owner, repo, ref: `tags/${tag}` })");
    expect(workflow).not.toContain('target_commitish:');
  });

  it('does not pass empty Apple signing secrets to unsigned macOS builds', () => {
    expect(workflow).not.toContain('APPLE_CERTIFICATE:');
    expect(workflow).not.toContain('APPLE_CERTIFICATE_PASSWORD:');
    expect(workflow).not.toContain('APPLE_SIGNING_IDENTITY:');
    expect(workflow).not.toContain('APPLE_ID:');
    expect(workflow).not.toContain('APPLE_PASSWORD:');
    expect(workflow).not.toContain('APPLE_TEAM_ID:');
  });

  it("builds the moved desktop Tauri project", () => {
    expect(workflow).toContain("projectPath: apps/desktop");
    expect(workflow).toContain("workspaces: apps/desktop/src-tauri");
    expect(workflow).not.toContain("workspaces: src-tauri");
  });
});
