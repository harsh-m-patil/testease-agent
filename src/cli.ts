#!/usr/bin/env node

import { ConfigError, requireDomain, resolveConfig } from './config.ts';
import { runDoctor } from './doctor.ts';
import { createRunEnvelope } from './run-envelope.ts';

const HELP_TEXT = `testease - AI-assisted website test generation

Usage:
  testease <command> [options]

Commands:
  plan       Discover and draft a test plan
  sync       Sync markdown plan edits into canonical plan JSON
  approve    Approve a plan hash for generation
  generate   Generate Playwright tests from approved plan
  run        Execute lifecycle run operations
  doctor     Validate local runtime prerequisites

Global options:
  -h, --help   Show help

Config precedence:
  CLI > env > config > defaults
`;

function handleRun(commandArgv: string[]) {
  const config = resolveConfig(commandArgv);
  const domain = requireDomain(config);
  const envelope = createRunEnvelope(config.outputRoot, domain);

  process.stdout.write(`Run created\n`);
  process.stdout.write(`runId: ${envelope.runId}\n`);
  process.stdout.write(`domain: ${domain}\n`);
  process.stdout.write(`domainSlug: ${envelope.domainSlug}\n`);
  process.stdout.write(`runDir: ${envelope.runDir}\n`);
  process.stdout.write(`logFile: ${envelope.logFile}\n`);
}

function main(argv: string[]) {
  const [command, ...commandArgv] = argv;

  if (!command || command === '--help' || command === '-h') {
    process.stdout.write(`${HELP_TEXT}\n`);
    process.exitCode = 0;
    return;
  }

  try {
    if (command === 'run') {
      handleRun(commandArgv);
      process.exitCode = 0;
      return;
    }

    if (command === 'doctor') {
      process.exitCode = runDoctor(commandArgv);
      return;
    }

    process.stdout.write(`Command '${command}' not implemented yet.\n`);
    process.exitCode = 0;
  } catch (error) {
    if (error instanceof ConfigError) {
      process.stderr.write(`Config error: ${error.message}\n`);
      process.exitCode = 2;
      return;
    }

    const message = error instanceof Error ? error.message : 'Unknown failure';
    process.stderr.write(`Unhandled error: ${message}\n`);
    process.exitCode = 1;
  }
}

main(process.argv.slice(2));
