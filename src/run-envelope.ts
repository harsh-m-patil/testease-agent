import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface RunEnvelope {
  runId: string;
  domainSlug: string;
  runDir: string;
  logFile: string;
}

export function slugifyDomain(domain: string): string {
  return domain
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function createRunEnvelope(outputRoot: string, domain: string): RunEnvelope {
  const domainSlug = slugifyDomain(domain);
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  const runDir = join(outputRoot, domainSlug, 'runs', runId);
  const logFile = join(runDir, 'events.jsonl');

  mkdirSync(runDir, { recursive: true });

  writeFileSync(
    join(runDir, 'run.json'),
    JSON.stringify({ runId, domain, domainSlug, createdAt: new Date().toISOString() }, null, 2),
    'utf8',
  );

  writeFileSync(
    logFile,
    `${JSON.stringify({ ts: new Date().toISOString(), level: 'info', event: 'run_started', runId, domainSlug })}\n`,
    'utf8',
  );

  return {
    runId,
    domainSlug,
    runDir,
    logFile,
  };
}
