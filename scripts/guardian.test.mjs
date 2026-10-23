import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const guardianScript = path.resolve(__dirname, 'guardian.mjs');

test('guardian.mjs', async (t) => {
  let tmpDir;

  t.beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-test-'));
    spawnSync('git', ['init'], { cwd: tmpDir });
    spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tmpDir });
    spawnSync('git', ['config', 'user.name', 'Test User'], { cwd: tmpDir });
  });

  t.afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const allRequiredFiles = [
    ".github/CODEOWNERS",
    ".github/workflows/guardian.yml",
    "CODE_OF_CONDUCT.md",
    "CONTRIBUTING.md",
    "GOVERNANCE.md",
    "LICENSE",
    "PULL_REQUEST_TEMPLATE.md",
    "README.md",
    "SECURITY.md",
    "SUPPORT.md",
    "profile/README.md",
    "profile/mavula_branding.png",
  ];

  function setupValidProject(options = {}) {
    const filesToCreate = options.skipFiles
      ? allRequiredFiles.filter(f => !options.skipFiles.includes(f))
      : allRequiredFiles;

    for (const file of filesToCreate) {
      const fullPath = path.join(tmpDir, file);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      if (file === 'profile/README.md') {
        fs.writeFileSync(fullPath, "mavulahq/finance-platform mavula.io mavula.dev security@mavula.io legal@mavula.io");
      } else {
        fs.writeFileSync(fullPath, "some content");
      }
    }

    spawnSync('git', ['add', '.'], { cwd: tmpDir });
  }

  function runGuardian() {
    return spawnSync('node', [guardianScript], { cwd: tmpDir, encoding: 'utf8' });
  }

  await t.test('passes when all requirements are met', () => {
    setupValidProject();
    const result = runGuardian();
    assert.strictEqual(result.status, 0, result.stderr);
    assert.match(result.stdout, /MAVULA organization profile guardian passed\./);
  });

  await t.test('fails if a required file is missing', () => {
    setupValidProject({ skipFiles: ['CODE_OF_CONDUCT.md'] });
    const result = runGuardian();
    assert.strictEqual(result.status, 1);
    assert.match(result.stderr, /CODE_OF_CONDUCT\.md is required/);
  });

  await t.test('fails if profile/README.md is missing', () => {
    setupValidProject({ skipFiles: ['profile/README.md'] });
    const result = runGuardian();
    assert.strictEqual(result.status, 1);
    assert.match(result.stderr, /profile\/README\.md is required|ENOENT/);
  });

  await t.test('fails if profile/README.md is missing patterns', () => {
    setupValidProject();
    fs.writeFileSync(path.join(tmpDir, 'profile/README.md'), "missing patterns");
    const result = runGuardian();
    assert.strictEqual(result.status, 1);
    assert.match(result.stderr, /profile\/README\.md is missing \/mavula\\.io\//);
  });

  await t.test('fails if .env file is tracked', () => {
    setupValidProject();
    fs.writeFileSync(path.join(tmpDir, '.env'), "SECRET=1");
    spawnSync('git', ['add', '.env'], { cwd: tmpDir });
    const result = runGuardian();
    assert.strictEqual(result.status, 1);
    assert.match(result.stderr, /\.env must not be tracked/);
  });

  await t.test('passes if .env.example is tracked', () => {
    setupValidProject();
    fs.writeFileSync(path.join(tmpDir, '.env.example'), "SECRET=1");
    spawnSync('git', ['add', '.env.example'], { cwd: tmpDir });
    const result = runGuardian();
    assert.strictEqual(result.status, 0, result.stderr);
  });

  await t.test('fails if legacy public identifiers are present', () => {
    setupValidProject();
    fs.writeFileSync(path.join(tmpDir, 'somefile.txt'), "this has getfluxo-io in it");
    spawnSync('git', ['add', 'somefile.txt'], { cwd: tmpDir });
    const result = runGuardian();
    assert.strictEqual(result.status, 1);
    assert.match(result.stderr, /somefile\.txt contains legacy public identifiers/);
  });

  await t.test('ignores legacy public identifiers in image files', () => {
    setupValidProject();
    fs.writeFileSync(path.join(tmpDir, 'image.png'), "this has getfluxo-io in it but it is an image");
    spawnSync('git', ['add', 'image.png'], { cwd: tmpDir });
    const result = runGuardian();
    assert.strictEqual(result.status, 0, result.stderr);
  });

  await t.test('fails if git ls-files fails', () => {
    setupValidProject();
    fs.rmSync(path.join(tmpDir, '.git'), { recursive: true, force: true });
    const result = runGuardian();
    assert.strictEqual(result.status, 1);
    assert.match(result.stderr, /git ls-files failed/);
  });
});
