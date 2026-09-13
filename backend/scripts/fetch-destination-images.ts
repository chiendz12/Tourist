/**
 * Bulk-resolves accurate Wikipedia/Wikimedia photos for destinations.
 *
 *   FORCE_IMAGES=1 npx ts-node scripts/fetch-destination-images.ts
 *
 * Without FORCE_IMAGES it only fills destinations with no image; with it,
 * every destination is re-resolved (used to replace placeholder images).
 * Prints a slug → URL map that can be pasted into prisma/seed.ts.
 */
import { PrismaClient } from '@prisma/client';
import { resolveWikipediaImage } from '../src/utils/wiki-image.util';
import { loadOverrideMap } from './wiki-image-overrides';

const prisma = new PrismaClient();
const FORCE = process.env.FORCE_IMAGES === '1';
const DELAY_MS = 150;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const destinations = await prisma.destination.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      images: true,
      province: { select: { name: true } },
    },
  });

  const overrides = await loadOverrideMap();

  const mapping: Record<string, string> = {};
  for (const destination of destinations) {
    const existing = Array.isArray(destination.images)
      ? (destination.images as unknown[]).filter(
          (item): item is string => typeof item === 'string',
        )
      : [];
    if (!FORCE && existing.length > 0) continue;

    const overrideUrl = overrides[destination.slug];
    let url: string | null = overrides[destination.slug] ?? null;
    if (!url) {
      url = await resolveWikipediaImage(destination.name, destination.province?.name);
    }

    if (url) {
      await prisma.destination.update({
        where: { id: destination.id },
        data: { images: [url] },
      });
      mapping[destination.slug] = url;
      const source = overrideUrl ? 'OVERRIDE' : existing.length ? 'AUTO' : 'AUTO';
      console.log(`${source} ${destination.slug} -> ${url}`);
    } else {
      console.log(`MISS ${destination.slug}`);
    }
    await sleep(DELAY_MS);
  }

  console.log('\n// Paste into prisma/seed.ts as IMAGE_OVERRIDES:');
  console.log(JSON.stringify(mapping, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
