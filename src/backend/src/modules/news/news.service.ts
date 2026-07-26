import { Injectable, Logger } from '@nestjs/common';
import { RssNewsService, RssNewsItem } from './rss-news.service';

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  symbols: string[];
  category: string;
  publishedAt: Date;
  source: string;
  sentiment: number;
}

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);

  constructor(private readonly rssNewsService: RssNewsService) {
    this.logger.log('News Service initialized with RSS feeds');
  }

  async getNews(category?: string, limit: number = 20): Promise<NewsItem[]> {
    let items: RssNewsItem[];
    try {
      items = await this.rssNewsService.fetchNews();
    } catch {
      this.logger.warn('Failed to fetch news, using cache');
      items = this.rssNewsService.getCachedNews();
    }

    if (category) {
      items = items.filter((n) => n.category === category);
    }

    return items.slice(0, limit).map(this.toNewsItem);
  }

  async getNewsForSymbol(symbol: string, limit: number = 20): Promise<NewsItem[]> {
    const upperSymbol = symbol.toUpperCase();
    let items: RssNewsItem[];
    try {
      items = await this.rssNewsService.fetchNews();
    } catch {
      items = this.rssNewsService.getCachedNews();
    }

    const matching = items.filter((n) => n.symbols.includes(upperSymbol));
    return matching.slice(0, limit).map(this.toNewsItem);
  }

  // Use the RssNewsService directly for the latest headlines
  async getLatestHeadlines(limit: number = 10): Promise<NewsItem[]> {
    let items: RssNewsItem[];
    try {
      items = await this.rssNewsService.fetchNews();
    } catch {
      items = this.rssNewsService.getCachedNews();
    }
    return items.slice(0, limit).map(this.toNewsItem);
  }

  private toNewsItem(rss: RssNewsItem): NewsItem {
    return {
      id: rss.id,
      title: rss.title,
      content: rss.description,
      symbols: rss.symbols,
      category: rss.category,
      publishedAt: rss.publishedAt,
      source: rss.source,
      sentiment: rss.sentiment,
    };
  }
}
