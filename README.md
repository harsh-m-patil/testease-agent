# testease-agent

Bootstrap CLI shell for the TestEase lifecycle.

## Implemented in Slice 1 (Issue #2)

- Lifecycle-oriented CLI commands with structured help:
  - `plan`, `sync`, `approve`, `generate`, `run`, `doctor`
- Config resolution with precedence:
  - **CLI > env > config > defaults**
- Actionable config validation errors
- `doctor` command with pass/fail diagnostics and exit codes
- Run envelope creation with:
  - `runId`
  - domain slug (`<outputRoot>/<domainSlug>/runs/<runId>`)
  - persisted `run.json`
  - persisted structured log file `events.jsonl`

## Quickstart

```bash
npm install
npm test
```

Show CLI help:

```bash
node --import tsx src/cli.ts --help
```

Run doctor:

```bash
node --import tsx src/cli.ts doctor --output-root .testease
```

Create a run envelope:

```bash
node --import tsx src/cli.ts run --domain docs.example.com --output-root .testease
```

## Config sources

`run`/`doctor` support config via:

- CLI flags: `--config`, `--domain`, `--output-root`
- Environment:
  - `TESTEASE_CONFIG`
  - `TESTEASE_DOMAIN`
  - `TESTEASE_OUTPUT_ROOT`
- Config file JSON (`--config path/to/file.json`)
- Defaults (`outputRoot = .testease`)

Precedence is always:

```text
CLI > env > config > defaults
```

## Tests

Current tests are integration-style via CLI public behavior (`tests/cli.test.ts`) and cover:

- help command structure
- config precedence
- validation errors
- doctor pass/fail diagnostics
- run envelope + structured log persistence
