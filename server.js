const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3002;

// LANGUAGE selects the Audiolibrix locale/site. Supported: cs (Czech), sk (Slovak).
// 'cz' is accepted as an alias for 'cs'. Defaults to Czech.
const rawLanguage = (process.env.LANGUAGE || 'cs').toLowerCase();
const language = rawLanguage === 'cz' ? 'cs' : rawLanguage;
const addAudiolibrixLinkToDescription =
  (process.env.ADD_AUDIOLIBRIX_LINK_TO_DESCRIPTION || 'true').toLowerCase() === 'true';

const LANGUAGES = {
  cs: { locale: 'cs', abs: 'czech', accept: 'cs-CZ' },
  sk: { locale: 'sk', abs: 'slovak', accept: 'sk-SK' },
};
const lang = LANGUAGES[language] || LANGUAGES.cs;

const BASE_URL = 'https://www.audiolibrix.com';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
// How many search hits to enrich with a detail-page fetch (bounds outgoing requests).
const MAX_DETAILS = 12;

app.use(cors());

// Audiobookshelf sends the Authorization header value configured for the provider.
// Require it to be present (parity with audioteka-abs).
app.use((req, res, next) => {
  if (!req.headers['authorization']) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

function absoluteUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return BASE_URL + (url.startsWith('/') ? url : '/' + url);
}

// "9:40 h" -> 580 (minutes). Audiobookshelf expects the duration in minutes.
function parseDuration(durationStr) {
  if (!durationStr) return undefined;
  const match = durationStr.match(/(\d+):(\d+)/);
  if (!match) return undefined;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

class AudiolibrixProvider {
  constructor() {
    this.searchUrl = `${BASE_URL}/${lang.locale}/Search/Results`;
  }

  async searchBooks(query) {
    const searchUrl = `${this.searchUrl}?query=${encodeURIComponent(query)}`;
    console.log('Search URL:', searchUrl);

    const response = await axios.get(searchUrl, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': lang.accept },
      timeout: 30000,
    });
    const $ = cheerio.load(response.data);

    const seen = new Set();
    const matches = [];
    $('article.alx-audiobook-list-item').each((index, element) => {
      const $book = $(element);
      const $link = $book.find('a.audiobook-link').first();
      const url = absoluteUrl($link.attr('href'));
      if (!url) return;

      const id = $link.attr('data-book-id') || url.split('/')[5];
      if (!id || seen.has(id)) return;
      seen.add(id);

      const title = ($link.attr('data-book-name') || $book.find('h2').attr('title') || $link.text()).trim();
      const authors = $book.find('dd.alx-author a').map((i, a) => $(a).text().trim()).get();
      const narrator = $book.find('dd.alx-narrator').text().trim();
      const cover = absoluteUrl($book.find('figure img.img-thumbnail').attr('src'));

      if (title) {
        matches.push({ id, title, authors, narrator, cover, url });
      }
    });

    console.log('Number of books found:', matches.length);

    const enriched = await Promise.all(
      matches.slice(0, MAX_DETAILS).map((match) => this.getFullMetadata(match))
    );
    return { matches: enriched };
  }

  async getFullMetadata(match) {
    try {
      console.log(`Fetching full metadata for: ${match.title}`);
      const response = await axios.get(match.url, {
        headers: { 'User-Agent': USER_AGENT, 'Accept-Language': lang.accept },
        timeout: 30000,
      });
      const $ = cheerio.load(response.data);

      // Build a label -> <dd> map from the detail metadata list.
      const meta = {};
      $('dl.alx-metadata dt').each((i, dt) => {
        const label = $(dt).text().replace(':', '').trim().toLowerCase();
        meta[label] = $(dt).next('dd');
      });
      const ddText = (label) => (meta[label] ? meta[label].text().trim() : '');
      const ddLinks = (label) =>
        meta[label] ? meta[label].find('a').map((i, a) => $(a).text().trim()).get() : [];

      const narrator = match.narrator || (ddLinks('interpret')[0] || '');
      const authors = match.authors && match.authors.length ? match.authors : ddLinks('autor');

      const publisher = ddLinks('vydavatel')[0] || ddLinks('nakladatel')[0] || undefined;
      const yearMatch = ddText('vydavatel').match(/\((\d{4})\)/);
      const publishedYear = yearMatch ? yearMatch[1] : undefined;

      const duration = parseDuration(ddText('délka') || ddText('stopáž'));
      const genres = ddLinks('žánry').length ? ddLinks('žánry') : ddLinks('žánr');

      // Description comes from the "Anotace" card.
      let descriptionHtml = '';
      $('h2.card-title').each((i, h) => {
        if ($(h).text().trim().toLowerCase() === 'anotace') {
          const $body = $(h).closest('article, .card, .alx-card-clean').find('.card-body').first();
          descriptionHtml = $body.html() || '';
        }
      });
      let description = (descriptionHtml || $('meta[name="description"]').attr('content') || '').trim();
      if (description && addAudiolibrixLinkToDescription) {
        description = `<a href="${match.url}">Audiolibrix link</a><br><br>${description}`;
      }

      const cover = absoluteUrl($('.alx-audiobook-thumbnail img').attr('src')) || match.cover;

      return {
        ...match,
        authors,
        narrator,
        cover,
        publisher,
        publishedYear,
        duration,
        description: description || undefined,
        genres,
        series: [],
        languages: [lang.abs],
        identifiers: { audiolibrix: match.id },
      };
    } catch (error) {
      console.error(`Error fetching full metadata for ${match.title}:`, error.message);
      return match;
    }
  }
}

const provider = new AudiolibrixProvider();

app.get('/search', async (req, res) => {
  try {
    console.log('Received search request:', req.query);
    const query = req.query.query;
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    const results = await provider.searchBooks(query);

    // Format the response according to the Audiobookshelf custom-provider spec.
    const formattedResults = {
      matches: results.matches.map((book) => ({
        title: book.title,
        subtitle: book.subtitle || undefined,
        author: book.authors && book.authors.length ? book.authors.join(', ') : undefined,
        narrator: book.narrator || undefined,
        publisher: book.publisher || undefined,
        publishedYear: book.publishedYear || undefined,
        description: book.description || undefined,
        cover: book.cover || undefined,
        isbn: undefined,
        asin: undefined,
        genres: book.genres && book.genres.length ? book.genres : undefined,
        tags: undefined,
        series: undefined,
        language: book.languages && book.languages.length ? book.languages[0] : undefined,
        duration: book.duration,
      })),
    };

    console.log(`Sending ${formattedResults.matches.length} matches`);
    res.json(formattedResults);
  } catch (error) {
    console.error('Search error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(
    `Audiolibrix provider listening on port ${port}, language: ${language}, add link to description: ${addAudiolibrixLinkToDescription}`
  );
});
