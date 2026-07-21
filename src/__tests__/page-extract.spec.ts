import {
  extractJsonLd,
  extractWithReadability,
  extractWithTreeWalker,
  extractPage,
  getCachedExtraction,
  setCachedExtraction,
  type ExtractionResult,
} from '../utils/page-extract';

function setBodyHtml(html: string): void {
  document.body.innerHTML = html;
}

describe('extractJsonLd', () => {
  it('parses top-level JobPosting JSON-LD', () => {
    setBodyHtml(`
      <html><head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "JobPosting",
          "title": "Senior Frontend Engineer",
          "description": "<p>We are looking for a <b>Senior Frontend Engineer</b>.</p>",
          "hiringOrganization": { "@type": "Organization", "name": "Acme Corp" },
          "jobLocation": {
            "@type": "Place",
            "address": {
              "addressLocality": "Berlin",
              "addressRegion": "BE",
              "addressCountry": "DE"
            }
          }
        }
        </script>
      </head><body></body></html>
    `);

    const r = extractJsonLd(document);
    expect(r).not.toBeNull();
    expect(r?.title).toBe('Senior Frontend Engineer');
    expect(r?.company).toBe('Acme Corp');
    expect(r?.location).toBe('Berlin, BE, DE');
    expect(r?.description).toBe('We are looking for a Senior Frontend Engineer.');
  });

  it('parses JobPosting nested in @graph array', () => {
    setBodyHtml(`
      <html><head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "Organization", "name": "Acme" },
            { "@type": "JobPosting", "title": "Backend Engineer", "description": "Build APIs." }
          ]
        }
        </script>
      </head><body></body></html>
    `);

    const r = extractJsonLd(document);
    expect(r?.title).toBe('Backend Engineer');
    expect(r?.description).toBe('Build APIs.');
  });

  it('accepts @type as an array containing JobPosting', () => {
    setBodyHtml(`
      <html><head>
        <script type="application/ld+json">
        { "@context": "https://schema.org", "@type": ["JobPosting", "Thing"], "title": "Dev", "description": "Code stuff." }
        </script>
      </head><body></body></html>
    `);

    const r = extractJsonLd(document);
    expect(r?.title).toBe('Dev');
  });

  it('accepts hiringOrganization as a bare string', () => {
    setBodyHtml(`
      <html><head>
        <script type="application/ld+json">
        { "@context": "https://schema.org", "@type": "JobPosting", "title": "Eng", "description": "d", "hiringOrganization": "Initech" }
        </script>
      </head><body></body></html>
    `);

    const r = extractJsonLd(document);
    expect(r?.company).toBe('Initech');
  });

  it('returns null when title is missing', () => {
    setBodyHtml(`
      <html><head>
        <script type="application/ld+json">
        { "@context": "https://schema.org", "@type": "JobPosting", "description": "no title" }
        </script>
      </head><body></body></html>
    `);

    expect(extractJsonLd(document)).toBeNull();
  });

  it('returns null when description is missing', () => {
    setBodyHtml(`
      <html><head>
        <script type="application/ld+json">
        { "@context": "https://schema.org", "@type": "JobPosting", "title": "Eng" }
        </script>
      </head><body></body></html>
    `);

    expect(extractJsonLd(document)).toBeNull();
  });

  it('skips malformed JSON-LD without throwing', () => {
    setBodyHtml(`
      <html><head>
        <script type="application/ld+json">not-json{</script>
        <script type="application/ld+json">
        { "@context": "https://schema.org", "@type": "JobPosting", "title": "Real", "description": "ok" }
        </script>
      </head><body></body></html>
    `);

    const r = extractJsonLd(document);
    expect(r?.title).toBe('Real');
  });

  it('ignores non-JobPosting JSON-LD blocks', () => {
    setBodyHtml(`
      <html><head>
        <script type="application/ld+json">
        { "@context": "https://schema.org", "@type": "Organization", "name": "Acme" }
        </script>
      </head><body></body></html>
    `);

    expect(extractJsonLd(document)).toBeNull();
  });
});

describe('extractWithReadability', () => {
  it('returns text for an article-heavy page', () => {
    setBodyHtml(`
      <html><body>
        <nav>Skip this nav. ${'x'.repeat(3000)}</nav>
        <article>
          <h1>Senior Engineer</h1>
          <p>We are hiring a senior engineer to join our team. You will work on distributed systems, mentor junior engineers, and own critical services end-to-end. Our stack includes Go, Postgres, Kafka, and Kubernetes. We value pragmatism, clear communication, and a strong sense of ownership.</p>
          <p>Requirements: 5+ years building production systems, experience with one of Go/Java/Rust, comfort with on-call rotations, and a track record of shipping complex projects independently.</p>
        </article>
        <footer>Skip this footer. ${'y'.repeat(3000)}</footer>
      </body></html>
    `);

    const r = extractWithReadability(document);
    expect(r).not.toBeNull();
    expect((r?.text.length ?? 0)).toBeGreaterThan(200);
    expect(r?.text.toLowerCase()).toContain('senior engineer');
    expect(r?.text.toLowerCase()).toContain('hiring');
  });

  it('returns null for pages with no article-like content', () => {
    setBodyHtml(`
      <html><body>
        <nav>just nav</nav>
        <footer>just footer</footer>
      </body></html>
    `);

    expect(extractWithReadability(document)).toBeNull();
  });
});

describe('extractWithTreeWalker', () => {
  it('returns the main element text when present', () => {
    setBodyHtml(`
      <html><body>
        <main>
          <h1>Real content here</h1>
          ${'<p>paragraph</p>'.repeat(50)}
        </main>
      </body></html>
    `);

    const t = extractWithTreeWalker(document);
    expect(t).toContain('Real content here');
  });
});

describe('extraction cache', () => {
  beforeEach(async () => {
    await chrome.storage.session.clear();
  });

  it('round-trips an ExtractionResult via getCachedExtraction', async () => {
    const result: ExtractionResult = {
      source: 'jsonld',
      title: 'Cached Title',
      company: 'Cached Co',
      location: 'Berlin',
      description: 'cached desc',
      rawText: 'cached desc',
      url: 'https://example.com/job/1',
      ts: 1700000000000,
    };

    await setCachedExtraction(result);
    const got = await getCachedExtraction(result.url);
    expect(got).toEqual(result);
  });

  it('returns null when no cache entry exists', async () => {
    const got = await getCachedExtraction('https://example.com/never-seen');
    expect(got).toBeNull();
  });

  it('isolates entries by URL', async () => {
    const a: ExtractionResult = {
      source: 'jsonld', title: 'A', company: '', location: '', description: 'a', rawText: 'a',
      url: 'https://example.com/a', ts: 1,
    };
    const b: ExtractionResult = {
      source: 'jsonld', title: 'B', company: '', location: '', description: 'b', rawText: 'b',
      url: 'https://example.com/b', ts: 2,
    };
    await setCachedExtraction(a);
    await setCachedExtraction(b);
    expect((await getCachedExtraction(a.url))?.title).toBe('A');
    expect((await getCachedExtraction(b.url))?.title).toBe('B');
  });
});

describe('extractPage (orchestrator)', () => {
  beforeEach(async () => {
    await chrome.storage.session.clear();
  });

  it('returns JSON-LD result when present and caches it', async () => {
    setBodyHtml(`
      <html><head>
        <script type="application/ld+json">
        { "@context": "https://schema.org", "@type": "JobPosting", "title": "JL", "description": "JD" }
        </script>
      </head><body></body></html>
    `);

    const url = 'https://example.com/job/jl';
    const r = await extractPage(document, url);
    expect(r.source).toBe('jsonld');
    expect(r.title).toBe('JL');
    expect(r.url).toBe(url);

    const cached = await getCachedExtraction(url);
    expect(cached?.source).toBe('jsonld');
  });

  it('falls back to Readability when no JSON-LD', async () => {
    setBodyHtml(`
      <html><body>
        <nav>noise noise noise noise noise noise noise noise noise</nav>
        <article>
          <h1>Software Engineer</h1>
          <p>We are looking for a software engineer to build and maintain production services. The ideal candidate has strong fundamentals in algorithms, distributed systems, and one backend language such as Go, Python, or Java. You will collaborate closely with product, design, and infra to ship features end-to-end.</p>
          <p>Nice to have: experience with Kubernetes, observability tooling, and Postgres performance tuning.</p>
        </article>
        <footer>footer noise footer noise footer noise footer noise footer noise</footer>
      </body></html>
    `);

    const url = 'https://example.com/job/r';
    const r = await extractPage(document, url);
    expect(r.source).toBe('readability');
    expect(r.description.toLowerCase()).toContain('software engineer');
    expect(r.description.toLowerCase()).toContain('kubernetes');
  });

  it('returns cached extraction on second call', async () => {
    setBodyHtml(`
      <html><head>
        <script type="application/ld+json">
        { "@context": "https://schema.org", "@type": "JobPosting", "title": "First", "description": "D" }
        </script>
      </head><body></body></html>
    `);

    const url = 'https://example.com/job/cache';
    const first = await extractPage(document, url);
    expect(first.source).toBe('jsonld');

    // Mutate the DOM so any re-extraction would produce a different result
    setBodyHtml('<html><body>totally different</body></html>');

    const second = await extractPage(document, url);
    expect(second.source).toBe('jsonld');
    expect(second.title).toBe('First');
    expect(second.ts).toBe(first.ts);
  });
});