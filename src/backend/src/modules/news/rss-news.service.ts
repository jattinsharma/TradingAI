import { Injectable, Logger } from '@nestjs/common';

export interface RssNewsItem {
  id: string;
  title: string;
  description: string;
  link: string;
  publishedAt: Date;
  source: string;
  symbols: string[];
  category: string;
  sentiment: number; // -1 to 1
}

const RSS_FEEDS = [
  { url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', source: 'MarketWatch' },
  { url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories&category=crypto', source: 'MarketWatch Crypto' },
  { url: 'https://finance.yahoo.com/news/rssindex', source: 'Yahoo Finance' },
  { url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', source: 'CNBC' },
  { url: 'https://www.zerohedge.com/rss.xml', source: 'ZeroHedge' },
];

// Simple mapping of keywords to symbols
function extractSymbols(text: string): string[] {
  const patterns = [
    /\b(BTC|Bitcoin)\b/gi, /\b(ETH|Ethereum)\b/gi,
    /\bAAPL\b/g, /\bGOOGL|GOOG\b/g, /\bMSFT\b/g, /\bAMZN\b/g,
    /\bTSLA\b/g, /\bNVDA\b/g, /\bMETA|FB\b/g,
    /\bSPY\b/g, /\bQQQ\b/g, /\bDIA\b/g,
    /\b(SOL|Solana)\b/gi, /\b(XRP|Ripple)\b/gi, /\bDOGE\b/gi,
    /\bADA|Cardano\b/gi, /\bDOT\b/g, /\bLINK\b/g,
  ];
  const symbols = new Set<string>();
  text.split(/\s+/).forEach((word) => {
    const clean = word.replace(/[^a-zA-Z0-9]/g, '');
    patterns.forEach((pattern) => {
      if (pattern.test(clean)) {
        pattern.lastIndex = 0;
        const upper = clean.toUpperCase();
        if (upper === 'BTC' || upper === 'BITCOIN') symbols.add('BTC');
        else if (upper === 'ETH' || upper === 'ETHEREUM') symbols.add('ETH');
        else if (upper === 'SOL' || upper === 'SOLANA') symbols.add('SOL');
        else if (upper === 'XRP' || upper === 'RIPPLE') symbols.add('XRP');
        else symbols.add(upper);
      }
    });
  });
  return Array.from(symbols);
}

function categorize(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();
  if (/\b(bitcoin|btc|crypto|ethereum|altcoin|defi|nft|blockchain)\b/.test(text)) return 'crypto';
  if (/\b(stock|nasdaq|nyse|spy|etf|dividend|earnings|ipo)\b/.test(text)) return 'stocks';
  if (/\b(fed|federal reserve|interest rate|inflation|gdp|treasury|dollar|forex)\b/.test(text)) return 'macro';
  if (/\b(commodity|gold|silver|oil|energy|natural gas)\b/.test(text)) return 'commodities';
  return 'general';
}

function simpleSentiment(text: string): number {
  const positive = /\b(bullish|surge|rally|gain|profit|growth|positive|upgrade|breakthrough|outperform|beat|rise|soar)\b/gi;
  const negative = /\b(bearish|crash|decline|loss|drop|downgrade|sell-off|recession|inflation|volatile|risk|fall|plunge|slump)\b/gi;
  const posMatches = text.match(positive);
  const negMatches = text.match(negative);
  const pos = posMatches ? posMatches.length * 5 : 0;
  const neg = negMatches ? negMatches.length * 5 : 0;
  return Math.max(-1, Math.min(1, (pos - neg) / 100));
}

@Injectable()
export class RssNewsService {
  private readonly logger = new Logger(RssNewsService.name);
  private cachedNews: RssNewsItem[] = [];
  private lastFetch = 0;
  private readonly cacheTtlMs = 5 * 60 * 1000; // 5 minutes

  async fetchNews(): Promise<RssNewsItem[]> {
    const now = Date.now();
    if (this.cachedNews.length > 0 && now - this.lastFetch < this.cacheTtlMs) {
      return this.cachedNews;
    }

    this.logger.log('Fetching news from RSS feeds...');
    const allItems: RssNewsItem[] = [];

    for (const feed of RSS_FEEDS) {
      try {
        const items = await this.fetchFeed(feed);
        allItems.push(...items);
      } catch (err) {
        this.logger.warn(`Failed to fetch RSS feed ${feed.source}: ${(err as Error).message}`);
      }
    }

    // Deduplicate by title similarity
    const seen = new Set<string>();
    const unique: RssNewsItem[] = [];
    for (const item of allItems) {
      const key = item.title.toLowerCase().substring(0, 60);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(item);
      }
    }

    // Sort by date, newest first
    unique.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

    this.cachedNews = unique;
    this.lastFetch = now;
    this.logger.log(`Fetched ${unique.length} unique news items from ${RSS_FEEDS.length} feeds`);
    return unique;
  }

  private async fetchFeed(feed: { url: string; source: string }): Promise<RssNewsItem[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(feed.url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) return [];

    const xml = await response.text();
    return this.parseRssXml(xml, feed.source);
  }

  private parseRssXml(xml: string, source: string): RssNewsItem[] {
    const items: RssNewsItem[] = [];
    let id = 0;

    // Simple RSS/XML parser (works with standard RSS 2.0 and Atom)
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;

    const allMatches = [...xml.matchAll(itemRegex), ...xml.matchAll(entryRegex)];

    for (const match of allMatches) {
      try {
        const content = match[1];
        const title = this.extractTag(content, 'title');
        const description = this.extractTag(content, 'description') || this.extractTag(content, 'summary');
        const link = this.extractTag(content, 'link') || this.extractTagUrl(content);
        const pubDateStr = this.extractTag(content, 'pubDate') || this.extractTag(content, 'published') || this.extractTag(content, 'updated');
        const publishedAt = pubDateStr ? new Date(pubDateStr) : new Date();

        if (!title) continue;

        const text = `${title} ${description}`;
        id++;

        items.push({
          id: `rss-${source}-${id}`,
          title: this.stripHtml(title),
          description: this.stripHtml(description || '').substring(0, 500),
          link: this.stripHtml(link || ''),
          publishedAt,
          source,
          symbols: extractSymbols(text),
          category: categorize(title, description || ''),
          sentiment: simpleSentiment(text),
        });
      } catch {
        // Skip malformed items
      }
    }

    return items;
  }

  private extractTag(xml: string, tag: string): string | null {
    const regex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const match = xml.match(regex);
    if (!match) return null;
    return (match[1] || match[2] || '').trim();
  }

  private extractTagUrl(xml: string): string | null {
    const match = xml.match(/<link[^>]*href\s*=\s*"([^"]+)"/i);
    return match ? match[1] : null;
  }

  private stripHtml(text: string): string {
    return text.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
  }

  getNews(symbol?: string, limit: number = 20): RssNewsItem[] {
    let items = this.cachedNews;
    if (symbol) {
      const upper = symbol.toUpperCase();
      items = items.filter((n) => n.symbols.includes(upper));
    }
    return items.slice(0, limit);
  }

  getCachedNews(): RssNewsItem[] {
    return this.cachedNews;
  }
}
