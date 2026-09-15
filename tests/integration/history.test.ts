import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { CatalogDatabase } from '$lib/server/catalog/database';
import { CatalogRepository } from '$lib/server/catalog/repository';
import { createLocalApi, type LocalApi } from '$lib/server/api/local';
import type { EntryHistory } from '$lib/domain/entry-history';
import { GET } from '../../src/routes/api/entries/[kind]/[slug]/history/+server';
import { GET as entriesGET } from '../../src/routes/api/entries/+server';

// Replace only production runtime ownership. Requests execute the real route and repository.
vi.mock('$lib/server/scanning/runtime', () => ({
  get catalogRepository() {
    return repository;
  }
}));

let directory: string;
let database: CatalogDatabase;
let repository: CatalogRepository;
let api: LocalApi;
let server: ReturnType<typeof Bun.serve>;
let env: Record<string, string | undefined>;
let id: string;
const requested: string[] = [];
const today = new Date().toISOString().slice(0, 10);

beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), 'ongoing-history-contract-'));
  const commands = join(directory, 'bin');
  mkdirSync(commands);
  // Probing tools is allowed; executing a collector would fail the fixture.
  for (const command of ['git', 'gh', 'cloc'])
    writeFileSync(join(commands, command), '#!/bin/sh\nexit 99\n', { mode: 0o755 });
  vi.stubEnv('PATH', `${commands}:${process.env.PATH}`);
  const config = join(directory, 'config.toml');
  writeFileSync(config, '[providers]\nenabled = ["filesystem", "git", "github", "loc"]\n');
  env = {
    ...process.env,
    ONGOING_CONFIG: config,
    DATABASE_PATH: join(directory, 'catalog.sqlite')
  };
  database = new CatalogDatabase(env.DATABASE_PATH!);
  repository = new CatalogRepository(database, undefined, {
    providers: ['filesystem', 'git', 'github', 'loc']
  });
  const entry = await repository.upsertDiscovered({
    name: 'Example',
    canonicalPath: '/code/example',
    relativePath: 'example',
    scanRoot: '/code'
  });
  id = entry.id;
  await repository.updateMetrics(id, {
    githubAvailability: 'available',
    githubScannedAt: new Date().toISOString()
  });
  await repository.saveSnapshot({
    projectId: id,
    metric: 'github_stars',
    capturedOn: today,
    value: 42
  });
  await repository.createEntry({
    kind: 'technology',
    name: 'Example',
    attributes: { technology_kind: 'tool' }
  });
  api = createLocalApi(env);
  server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      requested.push(url.pathname);
      if (url.pathname === '/api/entries')
        return entriesGET({ url } as Parameters<typeof entriesGET>[0]);
      const match = /^\/api\/entries\/([^/]+)\/([^/]+)\/history$/.exec(url.pathname);
      if (match)
        return GET({
          url,
          params: { kind: decodeURIComponent(match[1]), slug: decodeURIComponent(match[2]) }
        } as Parameters<typeof GET>[0]);
      return new Response('Unexpected endpoint', { status: 404 });
    }
  });
});

afterAll(() => {
  server?.stop(true);
  api?.close();
  database?.close();
  vi.unstubAllEnvs();
  if (directory) rmSync(directory, { recursive: true, force: true });
});

async function cli(...args: string[]) {
  const child = Bun.spawn([process.execPath, 'run', 'bin/ongoing.ts', ...args], {
    cwd: process.cwd(),
    env,
    stdout: 'pipe',
    stderr: 'pipe'
  });
  const [stdout, stderr, status] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited
  ]);
  return { stdout: stdout.trim(), stderr: stderr.trim(), status };
}

describe('history HTTP, local transport and CLI contract', () => {
  it.each([
    ['project/example?metric=github_stars&days=90', 200],
    ['project/example?metric=github_stars&days=1', 200],
    ['project/example?metric=github_open_prs', 200],
    ['project/example?metric=loc_code', 200],
    ['project/missing?metric=github_stars', 404],
    ['technology/example?metric=loc_code', 400],
    ['invented/example?metric=loc_code', 400],
    ['project/example?metric=commits7d', 400],
    ['project/example?days=90', 400],
    ['project/example?metric=github_stars&days=0', 400],
    ['project/example?metric=github_stars&days=366', 400],
    ['project/example?metric=github_stars&days=2.5', 400],
    ['project/example?metric=github_stars&days=', 400]
  ])('agrees on %s (%s)', async (reference, status) => {
    const [entry, query] = String(reference).split('?');
    const path = `/api/entries/${entry}/history`;
    const http = await fetch(new URL(`${path}?${query}`, server.url));
    const local = await api.request(path, {
      query: Object.fromEntries(new URLSearchParams(query))
    });
    const embedded = await api.request(`${path}?${query}`);
    expect(http.status).toBe(status);
    expect(local.status).toBe(status);
    expect(embedded.status).toBe(status);
    const body = await http.json();
    expect(await local.json()).toEqual(body);
    expect(await embedded.json()).toEqual(body);
  });

  it('prints identical JSON through both CLI transports and useful human output without legacy reads', async () => {
    const args = ['history', 'project/example', '--metric', 'github_stars', '--days', '90'];
    const local = await cli(...args, '--local', '--json');
    const http = await cli(...args, '--url', server.url.toString(), '--json');
    expect(local.stderr).toBe('');
    expect(http.stderr).toBe('');
    expect(local.status).toBe(0);
    expect(http.status).toBe(0);
    const history = JSON.parse(local.stdout) as EntryHistory;
    expect(JSON.parse(http.stdout)).toEqual(history);
    expect(history).toMatchObject({
      entry: { id, kind: 'project', slug: 'example' },
      metric: 'github_stars',
      observations: [{ capturedOn: today, value: 42 }],
      availability: { state: 'available' },
      freshness: { state: 'fresh' }
    });
    const human = await cli('history', id, '--metric=github_stars', '--days=1', '--local');
    expect(human.status).toBe(0);
    expect(human.stdout).toContain('Example · github_stars');
    expect(human.stdout).toContain('History: available');
    expect(human.stdout).toContain('Freshness: fresh');
    expect(human.stdout).toContain(`${today}  42`);
    expect(requested).not.toContain('/api/projects');
  });

  it('makes the verb discoverable and refuses ambiguous, unsupported or invalid requests', async () => {
    const help = await cli('history', '--help');
    expect(help.status).toBe(0);
    expect(help.stdout).toContain('history <entry> --metric <metric>');
    expect(help.stdout).toContain('github_stars');
    for (const args of [
      ['history', 'project/example'],
      ['history', 'project/example', '--metric', 'github_stars', '--days'],
      ['history', 'project/example', '--metric', 'github_stars', '--days', '366'],
      ['history', 'technology/example', '--metric', 'github_stars'],
      ['history', 'missing', '--metric', 'github_stars'],
      ['history', 'example', '--metric', 'github_stars']
    ]) {
      const result = await cli(...args, '--local');
      expect(result.status, result.stdout).not.toBe(0);
      expect(result.stderr).not.toBe('');
    }
  });
});
