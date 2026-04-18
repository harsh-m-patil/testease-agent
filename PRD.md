## Problem Statement

As a developer/QA engineer, I want to quickly create maintainable automated tests for a website by providing only a URL, because writing test suites manually is slow, inconsistent, and expensive—especially during early project stages. I also need a human-approval checkpoint before code generation so the test scope stays intentional, safe, and cost-controlled.

## Solution

Build a Pi SDK-based test automation agent (MVP) that:

1. Accepts a website URL and explicit authorization flag.
2. Crawls the site (same-origin, bounded, Playwright-first) with conservative defaults.
3. Produces a concise, human-readable test plan and a canonical structured plan artifact.
4. Requires explicit hash-bound approval before generating tests.
5. Generates Playwright TypeScript tests using deterministic chunked orchestration.
6. Runs tests, performs one bounded self-heal pass for mechanical reliability issues, and reports outcomes.
7. Persists complete artifacts, logs, and run metadata for resumability, auditability, and CI automation.

The product is intentionally scoped to unauthenticated public websites in MVP, with architecture prepared for later authenticated crawling.

## User Stories

1. As a QA engineer, I want to pass a URL and get an initial crawl artifact, so that I can see what the agent discovered.
2. As a QA engineer, I want sitemap seeding plus link discovery, so that page coverage is broad without manual curation.
3. As a QA engineer, I want same-origin crawling by default, so that the suite stays focused on the target site.
4. As a QA engineer, I want max page limits with low defaults, so that token usage stays controlled in development.
5. As a QA engineer, I want max depth controls, so that crawl expansion remains bounded.
6. As a QA engineer, I want include/exclude URL globs, so that I can prioritize or block specific areas.
7. As a QA engineer, I want URL normalization and deduplication, so that duplicated paths do not waste budget.
8. As a QA engineer, I want tracking query params removed by default, so that analytics variants do not inflate crawl count.
9. As a QA engineer, I want configurable query allowlists/denylists, so that meaningful URL variants can still be preserved.
10. As a QA engineer, I want crawl prioritization by page importance/template uniqueness, so that the top 10 pages are the most valuable.
11. As a QA engineer, I want extracted page summaries to be structured and concise, so that planning is cost-efficient.
12. As a QA engineer, I want a concise human-readable plan before generation, so that I can validate scope early.
13. As a QA engineer, I want a canonical machine-readable plan, so that generation is deterministic.
14. As a QA engineer, I want to edit the markdown plan in guarded blocks, so that I can refine intent safely.
15. As a QA engineer, I want strict sync validation from markdown to canonical plan, so that malformed edits are rejected clearly.
16. As a QA engineer, I want approval to be tied to a plan hash, so that generation cannot run on stale plans.
17. As a QA engineer, I want explicit lifecycle commands (plan/sync/approve/generate/run), so that automation steps are auditable.
18. As a QA engineer, I want resumable runs with run IDs, so that interruptions do not force complete restarts.
19. As a QA engineer, I want immutable run snapshots plus latest outputs, so that I have both traceability and convenience.
20. As a QA engineer, I want domain-scoped outputs, so that multiple target sites can coexist in one workspace.
21. As a QA engineer, I want generated tests in Playwright TypeScript, so that I can run them in modern CI pipelines.
22. As a QA engineer, I want generated tests to cover smoke + structural + light behavior checks, so that suites are useful beyond trivial checks.
23. As a QA engineer, I want destructive actions disabled by default, so that accidental side effects are prevented.
24. As a QA engineer, I want an override for destructive actions, so that I can intentionally test deeper flows when safe.
25. As a QA engineer, I want stable selector strategies with fallback hierarchy, so that tests are resilient to DOM changes.
26. As a QA engineer, I want shared fixtures/helpers in generated tests, so that maintenance is centralized.
27. As a QA engineer, I want deterministic test naming/IDs, so that diffs, traceability, and self-heal are predictable.
28. As a QA engineer, I want sidecar metadata mapping tests to source pages/intents, so that coverage is explainable.
29. As a QA engineer, I want generated code auto-formatted, so that output quality is consistent.
30. As a QA engineer, I want generated README guidance per domain, so that teammates understand regeneration workflows.
31. As a QA engineer, I want a one-pass self-heal phase for failed tests, so that obvious mechanical flakiness is corrected.
32. As a QA engineer, I want self-heal to preserve test intent, so that reliability fixes do not silently weaken coverage.
33. As a QA engineer, I want self-heal limited to failed chunks and one pass, so that costs remain bounded.
34. As a QA engineer, I want confidence scoring and thresholds, so that low-quality plans can be blocked unless forced.
35. As a QA engineer, I want typed skipped-page reasons, so that I can diagnose coverage gaps quickly.
36. As a QA engineer, I want robots.txt respected by default, so that crawling behavior is responsible.
37. As a QA engineer, I want optional robots override, so that internal testing scenarios remain possible.
38. As a QA engineer, I want HTTPS enforcement by default, so that unsafe accidental targets are reduced.
39. As a QA engineer, I want authorization acknowledgement per run, so that misuse risk is reduced.
40. As a QA engineer, I want structured JSON logs saved to file, so that runs can be audited and debugged.
41. As a QA engineer, I want human-readable console summaries, so that local runs are easy to follow.
42. As a QA engineer, I want sensitive data redaction by default, so that logs/artifacts are safer to retain.
43. As a QA engineer, I want a controlled unsafe-debug mode, so that deep troubleshooting is still possible when needed.
44. As a QA engineer, I want LLM inputs/outputs archived per stage (sanitized), so that output drift can be investigated.
45. As a QA engineer, I want strict schema validation with retries, so that malformed model responses do not corrupt runs.
46. As a QA engineer, I want hard budget caps with per-stage controls, so that token spending is predictable.
47. As a QA engineer, I want graceful degrade when budget is hit, so that partial value is still delivered.
48. As a QA engineer, I want deterministic seeds in run metadata, so that behavior is reproducible.
49. As a developer, I want strict TypeScript and schema-first runtime validation, so that pipeline contracts remain reliable.
50. As a developer, I want modular deep components behind stable interfaces, so that future monorepo extraction is easy.
51. As a developer, I want Pi SDK-only integration in MVP, so that future Pi-first evolution is straightforward.
52. As a developer, I want deterministic pipeline orchestration with bounded agentic sequencing, so that behavior stays predictable.
53. As a developer, I want chunked generation contracts and deterministic merges, so that large plans can be generated safely.
54. As a CI maintainer, I want distinct CLI exit codes, so that workflows can branch on approval, validation, budget, or test failures.
55. As a CI maintainer, I want separate plan and generate workflows, so that human approval can gate generation cleanly.
56. As a CI maintainer, I want local fixture benchmarks as hard gates, so that regression checks are deterministic.
57. As a CI maintainer, I want real external benchmarks as informational, so that real-world health is visible without flaking gates.
58. As a project lead, I want startup auto-bootstrap of Playwright scaffolding if missing, so that onboarding friction is low.
59. As a project lead, I want explicit non-goals for MVP, so that scope stays realistic and delivery stays fast.
60. As a project lead, I want a phased roadmap from thin slice to robust MVP, so that execution risk is managed.

## Implementation Decisions

- The current repository is effectively empty (no application code yet), so implementation starts from a greenfield baseline.
- MVP scope is public unauthenticated websites first; support for JS-heavy sites is planned next.
- Two-phase lifecycle is mandatory: planning first, generation only after explicit approval.
- Canonical source of truth is structured plan JSON; markdown is rendered for humans and synchronized back via strict validation.
- Approval uses a separate artifact containing a hash of canonical plan content; any plan change invalidates approval.
- Core architecture will be modular within a single package (designed for future monorepo extraction):
  - Command orchestration layer for explicit lifecycle commands.
  - Configuration and policy resolution module with precedence: CLI > env > config > defaults.
  - Crawl engine module (Playwright-first rendering, readiness strategy, frontier control, URL normalization, dedupe).
  - Page extraction module producing structured compact signals.
  - Planning module producing strict-schema plan JSON and confidence/coverage metadata.
  - Markdown rendering/sync module with guarded editable sections and schema-safe synchronization.
  - Approval gate module (hash creation/verification and approval metadata).
  - Generation orchestrator module using deterministic stage graph and bounded agentic sequencing via Pi SDK.
  - Chunk planner/executor module with strict chunk contracts and deterministic merge rules.
  - Test artifact composer module (Playwright specs, shared helpers, sidecar metadata, generated docs).
  - Execution and self-heal module (single bounded repair pass, intent-preserving changes).
  - Artifact/log store module with append-only events and derived snapshot state for resume.
  - Reporting module for coverage, confidence, skip taxonomy, and run summary.
  - Bootstrap/doctor module for environment checks and Playwright setup when absent.
- Output layout is domain-scoped and run-scoped with immutable snapshots plus convenient latest paths.
- Logging strategy combines human-readable console output and persisted structured JSON logs.
- Sensitive data is redacted by default across logs and LLM artifacts, with explicit unsafe override.
- LLM outputs must conform to strict schemas; retries are bounded and repair-oriented.
- Cost governance is first-class: hard caps, per-stage budgets, and graceful-degrade behavior.
- Safety defaults include HTTPS-only (except localhost), robots respected by default, and explicit authorization flag per run.
- Test generation defaults to Chromium but browser target remains configurable.
- Selector strategy uses deterministic fallback hierarchy (test IDs, semantic selectors, stable text, CSS last).
- Generated assertions focus on stable behavior (semantic/partial text checks over brittle exact-copy matches).
- Determinism is emphasized (seeded runs, deterministic naming, deterministic merge, deterministic command stages).
- CI strategy is split into planning and generation workflows with distinct exit-code semantics.
- Benchmark strategy is hybrid: deterministic local fixtures as gates, real public sites as informational checks.
- Personal Next.js portfolio is intended as one real-world benchmark target, with local and production modes configurable.

## Testing Decisions

- Good tests will validate externally observable behavior (contracts, artifacts, command outcomes, policies), not internal implementation details.
- Testing focus by module:
  - Configuration/policy resolution: precedence, defaults, validation failures.
  - URL normalization/frontier controls: dedupe, include/exclude matching, depth/page limits.
  - Crawl/extraction behavior: discovery boundaries, readiness handling, skip reason classification.
  - Plan schema and markdown sync: parse/render/sync round-trips, guarded edits, invalid edit rejection.
  - Approval gate: hash generation, mismatch invalidation, stale approval rejection.
  - Chunk orchestration and merge: contract enforcement, collision handling, deterministic output.
  - Generation outputs: naming determinism, metadata sidecars, helper contracts, formatting post-processing.
  - Execution/self-heal: failed-test targeting, one-pass cap, intent preservation checks.
  - Artifact/log persistence: event append semantics, state reconstruction, resumability.
  - Budget governance: stage caps, graceful degradation paths, exit codes.
  - CLI lifecycle behavior: command sequencing, error classes, machine-usable exit codes.
- Integration tests should run against:
  - In-repo local fixture site (deterministic baseline).
  - One local run of the personal Next.js site.
  - Optional informational external benchmarks.
- Contract tests should validate strict schema boundaries for all LLM-facing requests/responses.
- Prior art in this codebase is currently absent (greenfield repository), so tests will establish the baseline pattern from first implementation onward.

## Out of Scope

- Authenticated crawling and auth-guarded flow automation.
- Payment/checkout and other inherently destructive production actions by default.
- Full deep business-logic validation beyond generic public-site behavior checks.
- Visual regression testing.
- Mobile viewport matrix and full device coverage.
- Cross-browser matrix as default execution (beyond configurable opt-in).
- Incremental crawl diff and selective regeneration.
- Full autonomous tool-calling agents for planning/generation in MVP.
- Cryptographic signing infrastructure for approvals beyond hash-bound artifacts.
- Advanced secret provider integrations beyond future-ready design intent.

## Further Notes

- Delivery should begin with a thin vertical slice: crawl → canonical plan JSON → markdown render/sync → approval hash → generate small Playwright suite → execute + artifact capture.
- Keep implementation single-package for speed, but enforce deep module boundaries to support later monorepo extraction.
- Pi SDK is mandated for LLM integration in MVP; behavior should remain deterministic through strict schemas and bounded orchestration.
- The product’s value proposition depends on trust: deterministic outputs, explicit approvals, transparent artifacts, and safe defaults are as important as raw generation quality.

