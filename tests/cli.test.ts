import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { describe, expect, it } from 'vitest';

function runCli(args: string[], env: NodeJS.ProcessEnv = {}) {
  return spawnSync('node', ['--import', 'tsx', 'src/cli.ts', ...args], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

function runCliAsync(args: string[], env: NodeJS.ProcessEnv = {}) {
  return new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn('node', ['--import', 'tsx', 'src/cli.ts', ...args], {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('close', (status) => {
      resolve({ status, stdout, stderr });
    });
  });
}

async function startFixtureSite() {
  const server = createServer((req, res) => {
    const path = req.url ?? '/';

    if (path === '/sitemap.xml') {
      res.writeHead(200, { 'content-type': 'application/xml' });
      res.end(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>http://127.0.0.1:${(server.address() as { port: number }).port}/about</loc></url>
  <url><loc>http://127.0.0.1:${(server.address() as { port: number }).port}/products?utm_source=ad</loc></url>
</urlset>`);
      return;
    }

    if (path === '/' || path === '') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(`
<html><body>
  <a href="/about">About</a>
  <a href="/products?fbclid=123">Products duplicate variant</a>
  <a href="https://example.com/offsite">Offsite</a>
</body></html>`);
      return;
    }

    if (path.startsWith('/about')) {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(`
<html><body>
  <a href="/deep/page">Too deep page</a>
</body></html>`);
      return;
    }

    if (path.startsWith('/products')) {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<html><body><h1>Products</h1></body></html>');
      return;
    }

    if (path.startsWith('/deep/page')) {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<html><body><h1>Deep</h1></body></html>');
      return;
    }

    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const port = (server.address() as { port: number }).port;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
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
    expect(result.stdout).toContain('crawl');
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

  it('runs thin e2e sequence plan -> approve -> generate -> run', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'testease-slice2-'));

    const plan = runCli([
      'plan',
      '--domain',
      'docs.example.com',
      '--url',
      'https://docs.example.com',
      '--output-root',
      tempRoot,
    ]);
    expect(plan.status).toBe(0);

    const runIdLine = plan.stdout.split('\n').find((line) => line.startsWith('runId: '));
    expect(runIdLine).toBeTruthy();
    const runId = runIdLine!.replace('runId: ', '').trim();

    const approve = runCli([
      'approve',
      '--domain',
      'docs.example.com',
      '--run-id',
      runId,
      '--output-root',
      tempRoot,
    ]);
    expect(approve.status).toBe(0);
    expect(approve.stdout).toContain('approvalPath:');

    const generate = runCli([
      'generate',
      '--domain',
      'docs.example.com',
      '--run-id',
      runId,
      '--output-root',
      tempRoot,
    ]);
    expect(generate.status).toBe(0);
    expect(generate.stdout).toContain('specPath:');

    const run = runCli(
      ['run', '--domain', 'docs.example.com', '--run-id', runId, '--output-root', tempRoot],
      { TESTEASE_RUNNER_CMD: "node -e \"process.stdout.write('simulated pass\\n')\"" },
    );
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('simulated pass');
    expect(run.stdout).toContain('resultPath:');

    const runDir = join(tempRoot, 'docs-example-com', 'runs', runId);
    expect(existsSync(join(runDir, 'plan', 'plan.canonical.json'))).toBe(true);
    expect(existsSync(join(runDir, 'approval', 'approval.json'))).toBe(true);
    expect(existsSync(join(runDir, 'generated', 'tests', 'smoke.spec.ts'))).toBe(true);
    expect(existsSync(join(runDir, 'results', 'summary.json'))).toBe(true);
  });

  it('fails generate with non-zero exit when approval is missing', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'testease-slice2-fail-'));

    const plan = runCli([
      'plan',
      '--domain',
      'docs.example.com',
      '--url',
      'https://docs.example.com',
      '--output-root',
      tempRoot,
    ]);

    const runIdLine = plan.stdout.split('\n').find((line) => line.startsWith('runId: '));
    expect(runIdLine).toBeTruthy();
    const runId = runIdLine!.replace('runId: ', '').trim();

    const generate = runCli([
      'generate',
      '--domain',
      'docs.example.com',
      '--run-id',
      runId,
      '--output-root',
      tempRoot,
    ]);

    expect(generate.status).toBe(3);
    expect(generate.stderr).toContain('Approval artifact missing');
  });

  it('crawls sitemap + links with same-origin normalization dedupe and typed skips', async () => {
    const fixture = await startFixtureSite();

    try {
      const tempRoot = mkdtempSync(join(tmpdir(), 'testease-crawl-'));
      const createRun = await runCliAsync(['run', '--domain', '127.0.0.1', '--output-root', tempRoot]);
      expect(createRun.status).toBe(0);

      const runIdLine = createRun.stdout.split('\n').find((line) => line.startsWith('runId: '));
      expect(runIdLine).toBeTruthy();
      const runId = runIdLine!.replace('runId: ', '').trim();

      const crawl = await runCliAsync([
        'crawl',
        '--domain',
        '127.0.0.1',
        '--run-id',
        runId,
        '--url',
        `${fixture.baseUrl}/`,
        '--output-root',
        tempRoot,
        '--max-pages',
        '10',
        '--max-depth',
        '1',
      ]);

      expect(crawl.status).toBe(0);
      expect(crawl.stdout).toContain('crawlPath:');

      const crawlPath = join(tempRoot, '127-0-0-1', 'runs', runId, 'crawl', 'crawl.json');
      const artifact = JSON.parse(readFileSync(crawlPath, 'utf8')) as {
        selected: Array<{ url: string }>;
        skipped: Array<{ reason: string }>;
      };

      expect(artifact.selected.map((page) => page.url)).toContain(`${fixture.baseUrl}`);
      expect(artifact.selected.map((page) => page.url)).toContain(`${fixture.baseUrl}/about`);
      expect(artifact.selected.map((page) => page.url)).toContain(`${fixture.baseUrl}/products`);
      expect(artifact.skipped.map((skip) => skip.reason)).toContain('out_of_origin');
      expect(artifact.skipped.map((skip) => skip.reason)).toContain('duplicate_after_normalization');
      expect(artifact.skipped.map((skip) => skip.reason)).toContain('beyond_max_depth');
    } finally {
      await fixture.close();
    }
  });

  it('honors exclude controls and max-pages deterministically', async () => {
    const fixture = await startFixtureSite();

    try {
      const tempRoot = mkdtempSync(join(tmpdir(), 'testease-crawl-bounds-'));
      const createRun = await runCliAsync(['run', '--domain', '127.0.0.1', '--output-root', tempRoot]);
      const runId = createRun.stdout
        .split('\n')
        .find((line) => line.startsWith('runId: '))!
        .replace('runId: ', '')
        .trim();

      const crawl = await runCliAsync([
        'crawl',
        '--domain',
        '127.0.0.1',
        '--run-id',
        runId,
        '--url',
        `${fixture.baseUrl}/`,
        '--output-root',
        tempRoot,
        '--max-pages',
        '1',
        '--max-depth',
        '2',
        '--exclude',
        '/about*',
      ]);

      expect(crawl.status).toBe(0);

      const crawlPath = join(tempRoot, '127-0-0-1', 'runs', runId, 'crawl', 'crawl.json');
      const artifact = JSON.parse(readFileSync(crawlPath, 'utf8')) as {
        selected: Array<{ url: string }>;
        skipped: Array<{ url: string; reason: string }>;
      };

      expect(artifact.selected).toHaveLength(1);
      expect(artifact.selected[0]?.url).toBe(`${fixture.baseUrl}`);
      expect(artifact.skipped).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ reason: 'excluded_by_pattern' }),
          expect.objectContaining({ reason: 'beyond_max_pages' }),
        ]),
      );
    } finally {
      await fixture.close();
    }
  });
});
