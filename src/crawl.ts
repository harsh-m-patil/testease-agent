import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LifecycleError } from './lifecycle.ts';
import { slugifyDomain } from './run-envelope.ts';

type SkipReason =
  | 'out_of_origin'
  | 'excluded_by_pattern'
  | 'beyond_max_depth'
  | 'beyond_max_pages'
  | 'duplicate_after_normalization'
  | 'invalid_url'
  | 'fetch_failed';

interface QueueItem {
  url: string;
  depth: number;
  source: 'seed' | 'sitemap' | 'link';
}

interface CrawlOptions {
  outputRoot: string;
  domain: string;
  runId: string;
  url: string;
  maxPages: number;
  maxDepth: number;
  include: string[];
  exclude: string[];
  stripParams: string[];
}

interface CrawlArtifact {
  seedUrl: string;
  runId: string;
  selected: Array<{ url: string; depth: number; source: QueueItem['source'] }>;
  skipped: Array<{ url: string; depth: number; reason: SkipReason }>;
}

function resolveRunDir(outputRoot: string, domain: string, runId: string): string {
  return join(outputRoot, slugifyDomain(domain), 'runs', runId);
}

function appendEvent(runDir: string, event: Record<string, unknown>) {
  const logFile = join(runDir, 'events.jsonl');
  appendFileSync(logFile, `${JSON.stringify({ ts: new Date().toISOString(), ...event })}\n`, 'utf8');
}

function ensureRunExists(runDir: string, runId: string) {
  const runJsonPath = join(runDir, 'run.json');
  if (!existsSync(runJsonPath)) {
    throw new LifecycleError(
      `Run envelope missing for run '${runId}' at ${runJsonPath}. Create run first with 'testease run'.`,
    );
  }

  readFileSync(runJsonPath, 'utf8');
}

function toGlobRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

function matchesAnyGlob(pathname: string, patterns: string[]): boolean {
  if (patterns.length === 0) {
    return false;
  }

  return patterns.some((pattern) => toGlobRegex(pattern).test(pathname));
}

function normalizeUrl(rawUrl: string, stripParams: string[]): string {
  const url = new URL(rawUrl);
  url.hash = '';

  const stripSet = new Set(['fbclid', 'gclid', ...stripParams]);
  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith('utm_') || stripSet.has(key)) {
      url.searchParams.delete(key);
    }
  }

  const sortedEntries = [...url.searchParams.entries()].sort((a, b) => {
    const keyCompare = a[0].localeCompare(b[0]);
    if (keyCompare !== 0) {
      return keyCompare;
    }
    return a[1].localeCompare(b[1]);
  });

  url.search = '';
  for (const [key, value] of sortedEntries) {
    url.searchParams.append(key, value);
  }

  let path = url.pathname;
  if (path !== '/' && path.endsWith('/')) {
    path = path.slice(0, -1);
  }

  const query = url.searchParams.toString();
  if (path === '/') {
    return query.length > 0 ? `${url.origin}?${query}` : url.origin;
  }

  return query.length > 0 ? `${url.origin}${path}?${query}` : `${url.origin}${path}`;
}

function extractLinks(baseUrl: string, html: string): string[] {
  const links: string[] = [];
  const hrefRegex = /href=["']([^"']+)["']/gi;

  for (const match of html.matchAll(hrefRegex)) {
    const href = match[1];
    if (!href) {
      continue;
    }

    try {
      const absolute = new URL(href, baseUrl).toString();
      links.push(absolute);
    } catch {
      // invalid links are ignored; invalid_url tracks queue items that fail parsing
    }
  }

  return links;
}

async function fetchSitemapUrls(origin: string): Promise<string[]> {
  try {
    const response = await fetch(`${origin}/sitemap.xml`);
    if (!response.ok) {
      return [];
    }

    const xml = await response.text();
    const urls: string[] = [];

    for (const match of xml.matchAll(/<loc>(.*?)<\/loc>/gim)) {
      const candidate = match[1]?.trim();
      if (candidate) {
        urls.push(candidate);
      }
    }

    return urls;
  } catch {
    return [];
  }
}

export async function runCrawl(options: CrawlOptions) {
  const runDir = resolveRunDir(options.outputRoot, options.domain, options.runId);
  ensureRunExists(runDir, options.runId);

  const seed = new URL(options.url);
  const sitemapUrls = await fetchSitemapUrls(seed.origin);

  const frontier: QueueItem[] = [
    { url: options.url, depth: 0, source: 'seed' },
    ...sitemapUrls.map((url) => ({ url, depth: 1, source: 'sitemap' as const })),
  ];

  const seenNormalized = new Set<string>();
  const artifact: CrawlArtifact = {
    seedUrl: options.url,
    runId: options.runId,
    selected: [],
    skipped: [],
  };

  while (frontier.length > 0) {
    frontier.sort((a, b) => (a.depth === b.depth ? a.url.localeCompare(b.url) : a.depth - b.depth));
    const current = frontier.shift()!;

    let parsed: URL;
    try {
      parsed = new URL(current.url);
    } catch {
      artifact.skipped.push({ url: current.url, depth: current.depth, reason: 'invalid_url' });
      continue;
    }

    if (parsed.origin !== seed.origin) {
      artifact.skipped.push({ url: current.url, depth: current.depth, reason: 'out_of_origin' });
      continue;
    }

    if (current.depth > options.maxDepth) {
      artifact.skipped.push({ url: current.url, depth: current.depth, reason: 'beyond_max_depth' });
      continue;
    }

    if (options.include.length > 0 && !matchesAnyGlob(parsed.pathname, options.include)) {
      artifact.skipped.push({ url: current.url, depth: current.depth, reason: 'excluded_by_pattern' });
      continue;
    }

    if (matchesAnyGlob(parsed.pathname, options.exclude)) {
      artifact.skipped.push({ url: current.url, depth: current.depth, reason: 'excluded_by_pattern' });
      continue;
    }

    const normalized = normalizeUrl(current.url, options.stripParams);

    if (seenNormalized.has(normalized)) {
      artifact.skipped.push({
        url: current.url,
        depth: current.depth,
        reason: 'duplicate_after_normalization',
      });
      continue;
    }

    if (artifact.selected.length >= options.maxPages) {
      artifact.skipped.push({ url: current.url, depth: current.depth, reason: 'beyond_max_pages' });
      continue;
    }

    seenNormalized.add(normalized);

    try {
      const response = await fetch(current.url);
      if (!response.ok) {
        artifact.skipped.push({ url: current.url, depth: current.depth, reason: 'fetch_failed' });
        continue;
      }

      const html = await response.text();
      artifact.selected.push({ url: normalized, depth: current.depth, source: current.source });

      const links = extractLinks(current.url, html);
      for (const link of links) {
        frontier.push({ url: link, depth: current.depth + 1, source: 'link' });
      }
    } catch {
      artifact.skipped.push({ url: current.url, depth: current.depth, reason: 'fetch_failed' });
    }
  }

  const crawlDir = join(runDir, 'crawl');
  mkdirSync(crawlDir, { recursive: true });
  const crawlPath = join(crawlDir, 'crawl.json');
  writeFileSync(crawlPath, JSON.stringify(artifact, null, 2), 'utf8');

  appendEvent(runDir, {
    level: 'info',
    event: 'crawl_completed',
    runId: options.runId,
    selectedCount: artifact.selected.length,
    skippedCount: artifact.skipped.length,
  });

  return {
    crawlPath,
    selectedCount: artifact.selected.length,
    skippedCount: artifact.skipped.length,
  };
}
