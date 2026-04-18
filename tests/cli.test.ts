import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

function runCli(args: string[], env: NodeJS.ProcessEnv = {}) {
  return spawnSync('node', ['--import', 'tsx', 'src/cli.ts', ...args], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

describe('CLI shell', () => {
  it('shows lifecycle-oriented commands in help', () => {
    const result = runCli(['--help']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Commands:');
    expect(result.stdout).toContain('plan');
    expect(result.stdout).toContain('sync');
    expect(result.stdout).toContain('approve');
    expect(result.stdout).toContain('generate');
    expect(result.stdout).toContain('run');
    expect(result.stdout).toContain('doctor');
    expect(result.stdout).toContain('CLI > env > config > defaults');
  });

  it('resolves config with precedence CLI > env > config > defaults', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'testease-precedence-'));
    const configPath = join(tempRoot, 'testease.config.json');
    const configOutputRoot = join(tempRoot, 'from-config');
    const envOutputRoot = join(tempRoot, 'from-env');
    const cliOutputRoot = join(tempRoot, 'from-cli');

    writeFileSync(
      configPath,
      JSON.stringify({ domain: 'config.example.com', outputRoot: configOutputRoot }, null, 2),
      'utf8',
    );

    const result = runCli(
      ['run', '--config', configPath, '--domain', 'cli.example.com', '--output-root', cliOutputRoot],
      {
        TESTEASE_DOMAIN: 'env.example.com',
        TESTEASE_OUTPUT_ROOT: envOutputRoot,
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(cliOutputRoot);
    expect(result.stdout).toContain('cli-example-com');
  });

  it('returns actionable validation error when domain is missing', () => {
    const result = runCli(['run']);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Missing required 'domain'");
    expect(result.stderr).toContain('--domain');
    expect(result.stderr).toContain('TESTEASE_DOMAIN');
    expect(result.stderr).toContain('config');
  });

  it('doctor reports pass/fail diagnostics for prerequisites', () => {
    const result = runCli(['doctor', '--output-root', '/dev/null/forbidden']);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Doctor checks');
    expect(result.stdout).toContain('PASS');
    expect(result.stdout).toContain('FAIL');
  });

  it('creates a run envelope with run ID, domain-scoped path, and structured log', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'testease-envelope-'));
    const result = runCli(['run', '--domain', 'docs.example.com', '--output-root', tempRoot]);

    expect(result.status).toBe(0);

    const runDirLine = result.stdout
      .split('\n')
      .find((line) => line.startsWith('runDir: '));

    expect(runDirLine).toBeTruthy();

    const runDir = runDirLine!.replace('runDir: ', '').trim();
    const runJsonPath = join(runDir, 'run.json');
    const logPath = join(runDir, 'events.jsonl');

    expect(runDir).toContain(join(tempRoot, 'docs-example-com', 'runs'));
    expect(existsSync(runJsonPath)).toBe(true);
    expect(existsSync(logPath)).toBe(true);

    const runJson = JSON.parse(readFileSync(runJsonPath, 'utf8')) as { runId: string; domainSlug: string };
    expect(runJson.runId).toBeTruthy();
    expect(runJson.domainSlug).toBe('docs-example-com');

    const firstLogLine = readFileSync(logPath, 'utf8').trim().split('\n')[0];
    const event = JSON.parse(firstLogLine) as { event: string; runId: string };
    expect(event.event).toBe('run_started');
    expect(event.runId).toBe(runJson.runId);
  });
});
