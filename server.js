const express = require('express');
const axios = require('axios').default;
const cheerio = require('cheerio');
const Logger = { error: console.error }; // Simple logger for errors

const app = express();
const port = process.env.PORT || 3002;

class AudiolibrixProvider {
  #responseTimeout = 30000; // Timeout in milliseconds

  constructor() {}

  /**
   * Search for an audiobook on audiolibrix.com
   * @param {string} query - Search query (title, author, or ISBN)
   * @returns {Promise<Object[]>} - Array of audiobook metadata
   */
  async search(query) {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://www.audiolibrix.com/en/search?query=${encodedQuery}`;
    try {
      const response = await axios.get(url, { timeout: this.#responseTimeout });
      const $ = cheerio.load(response.data);
      const results = [];

      // Adjust selector based on Audiolibrix's HTML structure
      $('.product-tile, .search-result-item').each((index, element) => {
        const productUrl = $(element).find('a').attr('href');
        if (productUrl) {
          results.push(this.scrapeAudiobookDetails(productUrl));
        }
      });

      return Promise.all(results.filter((r) => r)); // Filter out null results
    } catch (error) {
      Logger.error('[AudiolibrixProvider] Search error', error);
      return [];
    }
  }

  /**
   * Scrape audiobook details from a specific URL
   * @param {string} url - Audiobook detail page URL
   * @returns {Promise<Object>} - Audiobook metadata
   */
  async scrapeAudiobookDetails(url) {
    try {
      const response = await axios.get(url, { timeout: this.#responseTimeout });
      const $ = cheerio.load(response.data);

      // Try to find JSON-LD or structured data
      let title, author, narrator, publisher, publishedYear, description, cover;
      try {
        const jsonLd = JSON.parse($('script[type="application/ld+json"]').html() || '{}');
        title = jsonLd.name || $('h1').text().trim();
        author = jsonLd.author || $('.author').text().trim();
        narrator = jsonLd.readBy || $('.narrator').text().trim();
        publisher = jsonLd.publisher || $('.publisher').text().trim();
        publishedYear = jsonLd.datePublished
          ? new Date(jsonLd.datePublished).getFullYear()
          : $('.published-year').text().trim();
        description = jsonLd.description || $('meta[name="description"]').attr('content') || $('.description').text().trim();
        cover = jsonLd.image || $('.cover-image').attr('src');
      } catch (e) {
        // Fallback to HTML scraping if JSON-LD is not available
        title = $('h1').text().trim();
        author = $('.author').text().trim();
        narrator = $('.narrator').text().trim();
        publisher = $('.publisher').text().trim();
        publishedYear = $('.published-year').text().trim();
        description = $('.description').text().trim();
        cover = $('.cover-image').attr('src');
      }

      return {
        title,
        subtitle: null,
        author: author || null,
        narrator: narrator || null,
        publisher: publisher || null,
        publishedYear: publishedYear || null,
        description: description || null,
        cover: cover ? `https://www.audiolibrix.com${cover}` : null,
        isbn: null, // Adjust if ISBN is available
        asin: null,
        genres: null,
        tags: null,
        series: null,
        language: 'en', // Adjust based on Audiolibrix’s language
        duration: null, // Adjust if duration is available
      };
    } catch (error) {
      Logger.error('[AudiolibrixProvider] Scraping error', error);
      return null;
    }
  }
}

const provider = new AudiolibrixProvider();

// Express route for Audiobookshelf compatibility
app.get('/search', async (req, res) => {
  const { query, timeout } = req.query;
  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  try {
    const results = await provider.search(query, timeout ? parseInt(timeout) : undefined);
    res.json(results);
  } catch (error) {
    Logger.error('[AudiolibrixProvider] Server error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`Audiolibrix metadata provider running on port ${port}`);
});