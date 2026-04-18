import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveConfig } from './config.ts';

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
}

function checkNodeVersion(): CheckResult {
  const major = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10);
  const passed = major >= 20;

  return {
    name: 'Node.js version',
    passed,
    message: passed
      ? `Detected Node.js ${process.versions.node}`
      : `Node.js 20+ required, found ${process.versions.node}`,
  };
}

function checkOutputRootWritable(outputRoot: string): CheckResult {
  const probeDir = join(outputRoot, '.doctor');
  const probeFile = join(probeDir, 'write-probe.txt');

  try {
    mkdirSync(probeDir, { recursive: true });
    writeFileSync(probeFile, 'ok', 'utf8');
    rmSync(probeDir, { recursive: true, force: true });

    return {
      name: 'Output root writable',
      passed: true,
      message: `Write probe succeeded at ${outputRoot}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown write failure';
    return {
      name: 'Output root writable',
      passed: false,
      message: `Cannot write to ${outputRoot}: ${message}`,
    };
  }
}

export function runDoctor(commandArgv: string[]): number {
  const config = resolveConfig(commandArgv);
  const checks: CheckResult[] = [
    checkNodeVersion(),
    checkOutputRootWritable(config.outputRoot),
  ];

  process.stdout.write('Doctor checks\n');

  for (const check of checks) {
    process.stdout.write(`${check.passed ? 'PASS' : 'FAIL'} ${check.name} - ${check.message}\n`);
  }

  return checks.every((check) => check.passed) ? 0 : 1;
}
