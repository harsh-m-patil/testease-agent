import { existsSync, readFileSync } from 'node:fs';

export interface AppConfig {
  outputRoot: string;
  domain?: string;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

interface FlagMap {
  configPath?: string;
  domain?: string;
  outputRoot?: string;
}

function readConfigFile(path?: string): Partial<AppConfig> {
  if (!path) {
    return {};
  }

  if (!existsSync(path)) {
    throw new ConfigError(`Config file not found at ${path}. Provide an existing --config path.`);
  }

  try {
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== 'object') {
      throw new ConfigError(`Config file at ${path} must contain a JSON object.`);
    }

    return parsed as Partial<AppConfig>;
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error;
    }

    throw new ConfigError(
      `Failed to parse config file at ${path}. Ensure it is valid JSON.`,
    );
  }
}

export function parseRunFlags(argv: string[]): FlagMap {
  const flags: FlagMap = {};

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (current === '--config') {
      flags.configPath = argv[index + 1];
      index += 1;
      continue;
    }

    if (current === '--domain') {
      flags.domain = argv[index + 1];
      index += 1;
      continue;
    }

    if (current === '--output-root') {
      flags.outputRoot = argv[index + 1];
      index += 1;
      continue;
    }
  }

  return flags;
}

export function resolveConfig(runArgv: string[]): AppConfig {
  const flags = parseRunFlags(runArgv);

  const configPath = flags.configPath ?? process.env.TESTEASE_CONFIG;
  const fileConfig = readConfigFile(configPath);

  const outputRoot =
    flags.outputRoot ??
    process.env.TESTEASE_OUTPUT_ROOT ??
    fileConfig.outputRoot ??
    '.testease';

  const domain = flags.domain ?? process.env.TESTEASE_DOMAIN ?? fileConfig.domain;

  if (!outputRoot || outputRoot.trim().length === 0) {
    throw new ConfigError(
      "Invalid outputRoot. Set --output-root, TESTEASE_OUTPUT_ROOT, or outputRoot in config.",
    );
  }

  return {
    outputRoot,
    domain,
  };
}

export function requireDomain(config: AppConfig): string {
  const domain = config.domain?.trim();

  if (!domain) {
    throw new ConfigError(
      "Missing required 'domain'. Provide --domain, TESTEASE_DOMAIN, or domain in config.",
    );
  }

  return domain;
}
