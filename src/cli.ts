#!/usr/bin/env node

import { Command } from 'commander';
import { ConfigError, requireDomain, type ConfigInputs, resolveConfig } from './config.ts';
import { runDoctor } from './doctor.ts';
import { LifecycleError, runApprove, runExecute, runGenerate, runPlan } from './lifecycle.ts';
import { createRunEnvelope } from './run-envelope.ts';

interface RunOptions extends ConfigInputs {
  runId?: string;
}

interface PlanOptions extends ConfigInputs {
  url: string;
}

interface LifecycleRunOptions extends ConfigInputs {
  runId: string;
}

function handleRun(options: RunOptions) {
  const config = resolveConfig(options);
  const domain = requireDomain(config);

  if (options.runId) {
    const executed = runExecute(config.outputRoot, domain, options.runId);
    process.stdout.write(`resultPath: ${executed.resultPath}\n`);
    process.exitCode = executed.exitCode;
    return;
  }

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

  if (error instanceof LifecycleError) {
    process.stderr.write(`Lifecycle error: ${error.message}\n`);
    process.exit(3);
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
  .option('--config <path>', 'Path to JSON config file')
  .requiredOption('--url <url>', 'Target URL for planning')
  .option('--domain <domain>', 'Target domain')
  .option('--output-root <path>', 'Output root directory')
  .action((options: PlanOptions) => {
    const config = resolveConfig(options);
    const domain = requireDomain(config);
    const planned = runPlan(config.outputRoot, domain, options.url);
    process.stdout.write('Plan created\n');
    process.stdout.write(`runId: ${planned.runId}\n`);
    process.stdout.write(`runDir: ${planned.runDir}\n`);
    process.stdout.write(`planPath: ${planned.planPath}\n`);
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
  .requiredOption('--run-id <runId>', 'Run ID produced by plan step')
  .option('--config <path>', 'Path to JSON config file')
  .option('--domain <domain>', 'Target domain')
  .option('--output-root <path>', 'Output root directory')
  .action((options: LifecycleRunOptions) => {
    const config = resolveConfig(options);
    const domain = requireDomain(config);
    const approval = runApprove(config.outputRoot, domain, options.runId);
    process.stdout.write('Plan approved\n');
    process.stdout.write(`planHash: ${approval.planHash}\n`);
    process.stdout.write(`approvalPath: ${approval.approvalPath}\n`);
  });

program
  .command('generate')
  .description('Generate Playwright tests from approved plan')
  .requiredOption('--run-id <runId>', 'Run ID produced by plan step')
  .option('--config <path>', 'Path to JSON config file')
  .option('--domain <domain>', 'Target domain')
  .option('--output-root <path>', 'Output root directory')
  .action((options: LifecycleRunOptions) => {
    const config = resolveConfig(options);
    const domain = requireDomain(config);
    const generated = runGenerate(config.outputRoot, domain, options.runId);
    process.stdout.write('Tests generated\n');
    process.stdout.write(`generatedDir: ${generated.generatedDir}\n`);
    process.stdout.write(`configPath: ${generated.configPath}\n`);
    process.stdout.write(`specPath: ${generated.specPath}\n`);
  });

program
  .command('run')
  .description('Execute lifecycle run operations')
  .option('--config <path>', 'Path to JSON config file')
  .option('--domain <domain>', 'Target domain')
  .option('--output-root <path>', 'Output root directory')
  .option('--run-id <runId>', 'Run ID to execute generated tests')
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
