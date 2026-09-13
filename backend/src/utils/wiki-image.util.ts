/**
 * Resolves an accurate representative photo for a Vietnamese destination from
 * Wikipedia/Wikimedia — no API key required, and Wikimedia allows hotlinking.
 *
 * Lookup order per title candidate:
 *   1. MediaWiki Action API "pageimages" — prefers the article's lead/infobox image.
 *   2. REST summary — thumbnail upscaled to 1280px, otherwise originalimage.
 *   3. Same chain repeated on en.wikipedia.org.
 *
 * Candidates per lookup: exact name → name+province → top search result.
 */
const USER_AGENT = 'VietJourney-ImageResolver/1.0 (+https://touristmap.local)';
const TIMEOUT_MS = 8000;

type WikiSummary = {
  title?: string;
  thumbnail?: { source?: string };
  originalimage?: { source?: string };
};

type WikiSearch = {
  query?: { search?: Array<{ title?: string }> };
};

type WikiPageImages = {
  query?: {
    pages?: Record<
      string,
      {
        title?: string;
        pageimage?: string;
        thumbnail?: { source?: string };
        original?: { source?: string };
      }
    >;
  };
};

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function pickBestPageImage(payload: WikiPageImages | null): string | null {
  if (!payload?.query?.pages) return null;
  const pages = Object.values(payload.query.pages);
  if (!pages.length) return null;
  const page = pages[0];
  const lead = page.pageimage && payload.query.pages[page.pageimage]
    ? payload.query.pages[page.pageimage]
    : page;
  return lead?.original?.source ?? lead?.thumbnail?.source ?? null;
}

async function pageImages(wiki: string, title: string): Promise<string | null> {
  const url =
    `https://${wiki}.wikipedia.org/w/api.php?action=query` +
    `&prop=pageimages&piprop=original|thumbnail&piprop=lead` +
    `&pilicense=any&titles=${encodeURIComponent(title)}&format=json&origin=*`;
  const payload = await fetchJson<WikiPageImages>(url);
  const value = pickBestPageImage(payload);
  if (!value) return null;
  // Lead URL is already a direct file URL; thumbnail upscaling uses the standard /NNNpx- prefix.
  if (/\/\d+px-/.test(value)) {
    return value.replace(/\/\d+px-/, '/1280px-');
  }
  return value;
}

async function summaryImage(wiki: string, title: string): Promise<string | null> {
  const url = `https://${wiki}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const summary = await fetchJson<WikiSummary>(url);
  if (!summary) return null;
  const thumb = summary.thumbnail?.source;
  if (thumb) return thumb.replace(/\/\d+px-/, '/1280px-');
  return summary.originalimage?.source ?? null;
}

async function searchTitle(wiki: string, query: string): Promise<string | null> {
  const url =
    `https://${wiki}.wikipedia.org/w/api.php?action=query&list=search` +
    `&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=1`;
  const data = await fetchJson<WikiSearch>(url);
  return data?.query?.search?.[0]?.title ?? null;
}

export async function resolveWikipediaImage(
  name: string,
  provinceName?: string | null,
): Promise<string | null> {
  const clean = name.trim().replace(/\s+/g, ' ');
  const candidates = [clean];
  if (provinceName) candidates.push(`${clean} ${provinceName.trim()}`);

  for (const wiki of ['vi', 'en']) {
    for (const title of candidates) {
      const image = await pageImages(wiki, title);
      if (image) return image;
      const summary = await summaryImage(wiki, title);
      if (summary) return summary;
    }
    for (const title of candidates) {
      const found = await searchTitle(wiki, title);
      if (found) {
        const image = await pageImages(wiki, found);
        if (image) return image;
        const summary = await summaryImage(wiki, found);
        if (summary) return summary;
      }
    }
  }
  return null;
}
