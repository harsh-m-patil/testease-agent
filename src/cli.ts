#!/usr/bin/env node

import { Command } from 'commander';
import { ConfigError, requireDomain, type ConfigInputs, resolveConfig } from './config.ts';
import { runDoctor } from './doctor.ts';
import { createRunEnvelope } from './run-envelope.ts';

interface RunOptions extends ConfigInputs {}

function handleRun(options: RunOptions) {
  const config = resolveConfig(options);
  const domain = requireDomain(config);
  const envelope = createRunEnvelope(config.outputRoot, domain);

  process.stdout.write('Run created\n');
  process.stdout.write(`runId: ${envelope.runId}\n`);
  process.stdout.write(`domain: ${domain}\n`);
  process.stdout.write(`domainSlug: ${envelope.domainSlug}\n`);
  process.stdout.write(`runDir: ${envelope.runDir}\n`);
  process.stdout.write(`logFile: ${envelope.logFile}\n`);
}

function handleCliError(error: unknown): never {
  if (error instanceof ConfigError) {
    process.stderr.write(`Config error: ${error.message}\n`);
    process.exit(2);
  }

  const message = error instanceof Error ? error.message : 'Unknown failure';
  process.stderr.write(`Unhandled error: ${message}\n`);
  process.exit(1);
}

const program = new Command();

program
  .name('testease')
  .description('AI-assisted website test generation')
  .addHelpText('after', '\nConfig precedence:\n  CLI > env > config > defaults\n');

program
  .command('plan')
  .description('Discover and draft a test plan')
  .action(() => {
    process.stdout.write("Command 'plan' not implemented yet.\n");
  });

program
  .command('sync')
  .description('Sync markdown plan edits into canonical plan JSON')
  .action(() => {
    process.stdout.write("Command 'sync' not implemented yet.\n");
  });

program
  .command('approve')
  .description('Approve a plan hash for generation')
  .action(() => {
    process.stdout.write("Command 'approve' not implemented yet.\n");
  });

program
  .command('generate')
  .description('Generate Playwright tests from approved plan')
  .action(() => {
    process.stdout.write("Command 'generate' not implemented yet.\n");
  });

program
  .command('run')
  .description('Execute lifecycle run operations')
  .option('--config <path>', 'Path to JSON config file')
  .option('--domain <domain>', 'Target domain')
  .option('--output-root <path>', 'Output root directory')
  .action((options: RunOptions) => {
    handleRun(options);
  });

program
  .command('doctor')
  .description('Validate local runtime prerequisites')
  .option('--config <path>', 'Path to JSON config file')
  .option('--domain <domain>', 'Target domain')
  .option('--output-root <path>', 'Output root directory')
  .action((options: ConfigInputs) => {
    process.exitCode = runDoctor(options);
  });

try {
  program.parse(process.argv);
} catch (error) {
  handleCliError(error);
}
