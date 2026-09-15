import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { CatalogDatabase } from '../../src/lib/server/catalog/database';
import { CatalogRepository } from '../../src/lib/server/catalog/repository';
import { transparentPng } from '../fixtures/png';

// `logos export` ships the viewer runtime from the private @impressions/logo overlay
// (see src/lib/logo-overlay.d.ts). Public clones do not install it, so the export half of
// this suite only runs where the overlay is present; everything else must pass without it.
const overlayRoot = join(process.cwd(), 'node_modules', '@impressions', 'logo');
const overlayPresent =
  existsSync(join(overlayRoot, 'dist', 'standalone.js')) &&
  existsSync(join(overlayRoot, 'dist', 'embed.js'));

const directories: string[] = [];
async function cli(databasePath: string, ...args: string[]) {
  const child = Bun.spawn(['bun', 'run', 'bin/ongoing.ts', ...args], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_PATH: databasePath },
    stdout: 'pipe',
    stderr: 'pipe'
  });
  const [stdout, stderr, status] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited
  ]);
  if (status !== 0) throw new Error(stderr || stdout);
  return stdout.trim();
}

afterEach(() => {
  for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true });
});

async function seedCatalog(): Promise<{
  directory: string;
  databasePath: string;
  entryId: string;
  bundle: unknown;
  bundlePath: string;
  document: unknown;
}> {
  const directory = mkdtempSync(join(tmpdir(), 'ongoing-cli-attachment-'));
  directories.push(directory);
  const databasePath = join(directory, 'catalog.sqlite');
  const database = new CatalogDatabase(databasePath);
  const repository = new CatalogRepository(database);
  const entry = await repository.upsertDiscovered({
    canonicalPath: '/code/ongoing',
    relativePath: 'ongoing',
    name: 'Ongoing',
    scanRoot: '/code'
  });
  await repository.upsertDiscovered({
    canonicalPath: '/code/without-logo',
    relativePath: 'without-logo',
    name: 'Without Logo',
    scanRoot: '/code'
  });
  database.close();
  const document = JSON.parse(
    readFileSync(join(process.cwd(), 'tests/fixtures/impressions-logo-v1.json'), 'utf8')
  );
  const bundle = {
    kind: 'impressions.logo.bundle',
    version: 1,
    document,
    poster: {
      mediaType: 'image/png',
      base64: transparentPng().toString('base64')
    }
  };
  const bundlePath = join(directory, 'input.json');
  writeFileSync(bundlePath, JSON.stringify(bundle));
  return { directory, databasePath, entryId: entry.id, bundle, bundlePath, document };
}

describe('attachment CLI', () => {
  it('sets, gets, and exports through the local API contract', async () => {
    const { databasePath, entryId, bundlePath, document } = await seedCatalog();
    const saved = JSON.parse(
      await cli(
        databasePath,
        'attachment',
        'set',
        entryId,
        '--field',
        'identity.logo',
        '--file',
        bundlePath,
        '--expected',
        'none',
        '--local',
        '--json'
      )
    );
    expect(saved).toMatchObject({
      entry: entryId,
      field: 'identity.logo',
      document,
      revision: expect.stringMatching(/^[a-f0-9]{64}$/)
    });
    const current = JSON.parse(
      await cli(
        databasePath,
        'attachment',
        'get',
        entryId,
        '--field',
        'identity.logo',
        '--local',
        '--json'
      )
    );
    expect(current).toMatchObject({ revision: saved.revision, document });
    expect(await cli(databasePath, 'list', 'identity.logo:*', '--local', '--count')).toBe('1');
    expect(await cli(databasePath, 'list', 'identity.logo:none', '--local', '--count')).toBe('1');
    // A consumer site pulls the whole set by slug; a project without a logo is reported, not fatal.
    const listing = JSON.parse(await cli(databasePath, 'logos', '--local', '--json'));
    expect(listing.logos.map((logo: { slug: string }) => logo.slug)).toEqual(['ongoing']);
    expect(listing.logos[0]).toMatchObject({
      id: entryId,
      revision: saved.revision,
      manifestUrl: expect.stringMatching(/^\/api\/artifacts\/[a-f0-9]{64}$/)
    });
    // A field the listing does not know yields an empty set rather than the default field's logos.
    const other = JSON.parse(
      await cli(databasePath, 'logos', '--field', 'identity.other', '--local', '--json')
    );
    expect(other.logos).toEqual([]);
  });

  it.runIf(overlayPresent)('exports the logo set for embedding', async () => {
    const { directory, databasePath, entryId, bundle, bundlePath, document } = await seedCatalog();
    const saved = JSON.parse(
      await cli(
        databasePath,
        'attachment',
        'set',
        entryId,
        '--field',
        'identity.logo',
        '--file',
        bundlePath,
        '--expected',
        'none',
        '--local',
        '--json'
      )
    );
    expect(saved.revision).toMatch(/^[a-f0-9]{64}$/);
    const output = join(directory, 'export');
    const exported = JSON.parse(
      await cli(
        databasePath,
        'attachment',
        'export',
        entryId,
        '--field',
        'identity.logo',
        '--output',
        output,
        '--local',
        '--json'
      )
    );
    expect(exported.files).toEqual(['manifest.json', 'poster.png', 'bundle.json']);
    expect(JSON.parse(readFileSync(join(output, 'bundle.json'), 'utf8'))).toEqual(bundle);

    // A consumer site pulls the whole set by slug; a project without a logo is reported, not fatal.
    const set = join(directory, 'identity');
    const pulled = JSON.parse(
      await cli(
        databasePath,
        'logos',
        'export',
        'ongoing',
        'without-logo',
        '--output',
        set,
        '--local',
        '--json'
      )
    );
    expect(pulled).toMatchObject({
      logos: { ongoing: saved.revision },
      missing: ['without-logo'],
      files: [
        'ongoing/logo.json',
        'ongoing/logo.png',
        'logos.json',
        'impressions-logo.js',
        'logo-embed.js'
      ]
    });
    expect(pulled.changed).toEqual(pulled.files);
    const manifest = JSON.parse(readFileSync(join(set, 'logos.json'), 'utf8'));
    expect(manifest).toMatchObject({
      schemaVersion: 1,
      kind: 'impressions.logo.set',
      source: 'ongoing',
      runtime: { script: 'impressions-logo.js', embed: 'logo-embed.js' },
      logos: {
        ongoing: {
          revision: saved.revision,
          document: 'ongoing/logo.json',
          poster: 'ongoing/logo.png'
        }
      }
    });
    expect(JSON.parse(readFileSync(join(set, 'ongoing/logo.json'), 'utf8'))).toEqual(document);
    expect(readFileSync(join(set, 'ongoing/logo.png')).equals(transparentPng())).toBe(true);
    expect(readFileSync(join(set, 'impressions-logo.js'), 'utf8')).toContain('ImpressionsLogo');
    // Unchanged catalog, unchanged bytes: a site that commits the set sees no diff.
    const again = JSON.parse(
      await cli(databasePath, 'logos', 'export', 'ongoing', '--output', set, '--local', '--json')
    );
    expect(again.changed).toEqual([]);
    expect(again.stale).toEqual([]);
    // A directory left by an earlier pull is reported when its project leaves the set.
    mkdirSync(join(set, 'retired'), { recursive: true });
    writeFileSync(join(set, 'retired', 'logo.json'), '{}');
    const pruned = JSON.parse(
      await cli(databasePath, 'logos', 'export', 'ongoing', '--output', set, '--local', '--json')
    );
    expect(pruned.stale).toEqual(['retired']);
  });
});
