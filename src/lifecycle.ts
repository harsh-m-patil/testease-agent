import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { slugifyDomain, createRunEnvelope } from './run-envelope.ts';

interface PlanArtifact {
  version: 1;
  targetUrl: string;
  tests: Array<{
    id: string;
    name: string;
    kind: 'smoke';
  }>;
}

export class LifecycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LifecycleError';
  }
}

function resolveRunDir(outputRoot: string, domain: string, runId: string): string {
  return join(outputRoot, slugifyDomain(domain), 'runs', runId);
}

function appendEvent(runDir: string, event: Record<string, unknown>) {
  const logFile = join(runDir, 'events.jsonl');
  appendFileSync(logFile, `${JSON.stringify({ ts: new Date().toISOString(), ...event })}\n`, 'utf8');
}

function readPlanText(runDir: string): string {
  const path = join(runDir, 'plan', 'plan.canonical.json');

  if (!existsSync(path)) {
    throw new LifecycleError(`Plan artifact missing at ${path}. Run 'testease plan' first.`);
  }

  return readFileSync(path, 'utf8');
}

function hashText(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function runPlan(outputRoot: string, domain: string, targetUrl: string) {
  const envelope = createRunEnvelope(outputRoot, domain);
  const planDir = join(envelope.runDir, 'plan');
  mkdirSync(planDir, { recursive: true });

  const plan: PlanArtifact = {
    version: 1,
    targetUrl,
    tests: [
      {
        id: 'smoke-controlled-page',
        name: 'controlled local page heading is visible',
        kind: 'smoke',
      },
    ],
  };

  const planPath = join(planDir, 'plan.canonical.json');
  writeFileSync(planPath, JSON.stringify(plan, null, 2), 'utf8');
  appendEvent(envelope.runDir, { level: 'info', event: 'plan_created', runId: envelope.runId });

  return {
    runId: envelope.runId,
    runDir: envelope.runDir,
    planPath,
  };
}

export function runApprove(outputRoot: string, domain: string, runId: string) {
  const runDir = resolveRunDir(outputRoot, domain, runId);
  const planText = readPlanText(runDir);
  const planHash = hashText(planText);

  const approvalDir = join(runDir, 'approval');
  mkdirSync(approvalDir, { recursive: true });
  const approvalPath = join(approvalDir, 'approval.json');

  writeFileSync(
    approvalPath,
    JSON.stringify({ runId, planHash, approvedAt: new Date().toISOString() }, null, 2),
    'utf8',
  );

  appendEvent(runDir, { level: 'info', event: 'plan_approved', runId, planHash });

  return {
    approvalPath,
    planHash,
  };
}

function requireApproval(runDir: string, runId: string, currentPlanHash: string) {
  const approvalPath = join(runDir, 'approval', 'approval.json');

  if (!existsSync(approvalPath)) {
    throw new LifecycleError(`Approval artifact missing at ${approvalPath}. Run 'testease approve' first.`);
  }

  const approval = JSON.parse(readFileSync(approvalPath, 'utf8')) as { planHash?: string };

  if (!approval.planHash || approval.planHash !== currentPlanHash) {
    throw new LifecycleError(
      `Approval hash mismatch for run '${runId}'. Re-run 'testease approve' for current plan.`,
    );
  }
}

export function runGenerate(outputRoot: string, domain: string, runId: string) {
  const runDir = resolveRunDir(outputRoot, domain, runId);
  const planText = readPlanText(runDir);
  const planHash = hashText(planText);
  requireApproval(runDir, runId, planHash);

  const generatedDir = join(runDir, 'generated');
  const testsDir = join(generatedDir, 'tests');
  mkdirSync(testsDir, { recursive: true });

  const configPath = join(generatedDir, 'playwright.config.ts');
  const specPath = join(testsDir, 'smoke.spec.ts');

  writeFileSync(
    configPath,
    `import { defineConfig } from '@playwright/test';\n\nexport default defineConfig({\n  testDir: './tests',\n  reporter: 'list',\n  use: {\n    headless: true,\n  },\n});\n`,
    'utf8',
  );

  writeFileSync(
    specPath,
    `import { test, expect } from '@playwright/test';\n\ntest('smoke controlled local page', async ({ page }) => {\n  await page.setContent('<main><h1>TestEase local fixture</h1></main>');\n  await expect(page.getByRole('heading', { name: 'TestEase local fixture' })).toBeVisible();\n});\n`,
    'utf8',
  );

  appendEvent(runDir, { level: 'info', event: 'tests_generated', runId, specPath });

  return {
    generatedDir,
    specPath,
    configPath,
  };
}

export function runExecute(outputRoot: string, domain: string, runId: string) {
  const runDir = resolveRunDir(outputRoot, domain, runId);
  const generatedDir = join(runDir, 'generated');
  const configPath = join(generatedDir, 'playwright.config.ts');

  if (!existsSync(configPath)) {
    throw new LifecycleError(
      `Generated tests missing at ${configPath}. Run 'testease generate' before 'testease run --run-id'.`,
    );
  }

  const command = process.env.TESTEASE_RUNNER_CMD ?? 'pnpm exec playwright test --config playwright.config.ts';
  const startedAt = new Date().toISOString();
  const child = spawnSync(command, {
    cwd: generatedDir,
    shell: true,
    encoding: 'utf8',
  });

  if (child.stdout) {
    process.stdout.write(child.stdout);
  }
  if (child.stderr) {
    process.stderr.write(child.stderr);
  }

  const finishedAt = new Date().toISOString();
  const resultsDir = join(runDir, 'results');
  mkdirSync(resultsDir, { recursive: true });
  const resultPath = join(resultsDir, 'summary.json');

  writeFileSync(
    resultPath,
    JSON.stringify(
      {
        runId,
        command,
        startedAt,
        finishedAt,
        exitCode: child.status ?? 1,
      },
      null,
      2,
    ),
    'utf8',
  );

  appendEvent(runDir, {
    level: child.status === 0 ? 'info' : 'error',
    event: 'tests_executed',
    runId,
    exitCode: child.status ?? 1,
  });

  return {
    resultPath,
    exitCode: child.status ?? 1,
  };
}
