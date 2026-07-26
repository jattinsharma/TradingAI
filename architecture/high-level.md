# High-Level Architecture

## Overview
The Universal AI Trading Copilot (V2) is a browser extension designed to assist traders across multiple trading platforms by providing AI-powered analysis, recommendations, and insights. The system follows a modular, event-driven architecture with clear separation of concerns.

## Core Principles
1. **Architecture First**: Complete architecture design before implementation.
2. **Modular Design**: Each module has a single responsibility.
3. **Replaceable Components**: Services can be replaced without affecting others.
4. **Clean Architecture**: Separation of Presentation, Domain, Application, and Infrastructure layers.
5. **Event-Driven System**: Use events for communication instead of polling where appropriate.
6. **SOLID Principles**: Adherence to SOLID principles for maintainable code.
7. **DRY**: Avoid duplication of logic.
8. **KISS**: Keep solutions simple.
9. **Dependency Injection**: Use DI for loose coupling.
10. **Feature-Based Architecture**: Organize code by features.
11. **Repository Pattern**: Abstract data access.
12. **Service Layer**: Encapsulate business logic.
13. **Strict Type Safety**: Use TypeScript for frontend and Node.js/TypeScript for backend.
14. **Production Quality Only**: No placeholders, TODOs, or temporary fixes.

## System Components

### 1. Browser Extension (Frontend)
- **Manifest V3**: Chrome/Firefox/Edge extension.
- **Built with**: React, TypeScript, Tailwind CSS.
- **Modules**:
  - Popup: UI for user interactions and settings.
  - Overlay: On-chart display of analysis and recommendations.
  - Background Service Worker: Handles events, messaging, and background tasks.
  - Content Scripts: Platform detection and DOM interaction.
  - Messaging: Communication between extension parts.
  - Authentication: User login and session management.
  - Adapter Manager: Manages platform-specific adapters.
  - Website Detection: Identifies trading platform and version.
  - Chart Observer: Monitors chart updates for symbol/timeframe changes.
  - Analysis: Coordinates analysis engines via orchestrator.
  - Alerts: Manages user notifications.
  - Watchlists: User-defined symbol watchlists.
  - Settings: User preferences and configuration.
  - Notifications: System and API notifications.
  - Storage: Local storage management (encrypted).
  - History: User interaction and recommendation history.
  - Analytics: Usage and performance analytics.

### 2. Platform Adapters
- **Universal Adapter Interface**: Defines contract for platform interactions.
- **Platform-Specific Adapters**: Implement the interface for each trading platform.
  - Supported platforms: TradingView, Binance, Bybit, Coinbase, Kraken, Zerodha, Upstox, AngelOne, MetaTrader, Generic.
- **Responsibilities**:
  - Extract chart data (OHLCV, indicators, drawings).
  - Execute trades (if permitted and configured).
  - Platform-specific UI interactions.

### 3. Analysis Engines (Plugin System)
Each engine is independent and communicates via the Recommendation Orchestrator.
- **Technical Engine**: Calculates technical indicators (RSI, MACD, Bollinger Bands, etc.).
- **Pattern Engine**: Detects chart patterns (head and shoulders, triangles, flags).
- **Trend Engine**: Identifies market trends (uptrend, downtrend, sideways).
- **Support & Resistance Engine**: Calculates support and resistance levels.
- **Volume Engine**: Analyzes volume profile and volume-based indicators.
- **Momentum Engine**: Measures price momentum and rate of change.
- **News Engine**: Fetches and processes financial news.
- **Sentiment Engine**: Analyzes market sentiment from news/social media.
- **Risk Engine**: Calculates risk metrics (position sizing, stop-loss, take-profit).
- **Portfolio Engine**: Analyzes portfolio allocation and risk.
- **Trade Planner**: Suggests trade entries, exits, and position sizing.
- **AI Explanation Engine**: Generates human-readable explanations for recommendations.

### 4. Recommendation Orchestrator
- Collects outputs from all analysis engines.
- Combines and weighs inputs to produce a unified recommendation.
- Generates explanations for each recommendation component.
- Outputs a structured recommendation object.

### 5. Backend Services (Node.js/NestJS)
- **REST APIs**: Versioned endpoints for data exchange.
- **Authentication**: JWT and refresh tokens.
- **Rate Limiting**: Protects APIs from abuse.
- **Logging & Monitoring**: Comprehensive logging and metrics.
- **Health Checks**: Endpoints for service health.
- **Services**:
  - User Management: Profiles, settings, preferences.
  - Market Data: Real-time and historical market data.
  - News & Sentiment: News aggregation and sentiment analysis.
  - Broker Connectivity: Secure broker API connections.
  - Recommendation History: Storage and retrieval of past recommendations.
  - Alerts Service: Managing user alerts and notifications.
  - Audit Logs: Security and operational audit trails.

### 6. Data Layer
- **Primary Database**: PostgreSQL (normalized schema).
- **Cache Layer**: Redis (for caching market data, recommendations, sessions, rate limits, AI responses).
- **Schema Includes**:
  - Users, Profiles, Settings
  - Watchlists, Recommendations, Alerts
  - Recommendation History, Paper Trades, Portfolio
  - Trade Journal, Feedback, Logs
  - Broker Connections, Future AI Memory

### 7. External Integrations
- **Market Data Providers**: Abstraction for price data (e.g., Alpha Vantage, Polygon, Binance API).
- **News Providers**: News API integration (e.g., Bloomberg, Reuters, CryptoPanic).
- **Broker APIs**: Secure connections to brokerage accounts (OAuth, API keys).
- **AI Providers**: Integration via Vercel AI Gateway for multiple LLM providers.

### 8. Event System
- **Internal Events**: Extension-wide events (chart update, symbol change, etc.).
- **Backend Events**: WebSocket or Server-Sent Events for real-time updates.
- **Message Queue**: For background job processing (using Vercel Queues or similar).

## Cross-Cutting Concerns
- **Security**: HTTPS, JWT, encrypted secrets, input validation, output sanitization, CSP, XSS protection, CSRF protection, rate limiting, audit logs.
- **Performance**: Lazy loading, code splitting, caching, optimized rendering, background processing, debouncing, efficient DOM observation, memory optimization.
- **Observability**: Logging, metrics, tracing, health checks.
- **Testing**: Unit, integration, end-to-end, performance, load, browser compatibility tests.
- **Deployment**: Docker, CI/CD, environment management (dev/staging/prod).

## Data Flow Overview
1. User visits a trading platform.
2. Extension detects platform and symbol via Website Detection and Chart Observer.
3. Chart Observer emits chart update events.
4. Analysis Orchestrator triggers relevant analysis engines.
5. Engines process data and return results to Orchestrator.
6. Orchestrator synthesizes recommendation and explanation.
7. Recommendation sent to Overlay and Popup for display.
8. User interactions (e.g., saving to watchlist) sent to Background Service Worker.
9. Background Service Worker syncs with Backend Services via secure APIs.
10. Backend processes data, updates database/cache, and sends real-time updates if needed.

## Extension Architecture Details
- **Content Scripts**: Run in context of trading platform pages, detect platform, extract chart data, inject extension UI.
- **Background Service Worker**: 
  - Manages extension lifecycle.
  - Handles messaging between content scripts, popup, and overlay.
  - Syncs data with backend.
  - Manages alarms and background tasks.
- **Popup**: User interface for settings, watchlists, manual analysis triggers.
- **Overlay**: Dynamic UI overlay on trading chart showing real-time analysis and recommendations.
- **Adapter Manager**: 
  - Loads appropriate platform adapter based on detected website.
  - Provides unified interface for data extraction and trade execution.
  - Handles platform-specific quirks and API differences.
- **Analysis Module**:
  - Receives chart data from adapter.
  - Dispatches to analysis engines via orchestrator.
  - Formats results for display.
- **Storage Module**: 
  - Uses chrome.storage.local with encryption for sensitive data.
  - Syncs with backend for cross-device persistence.
- **Alerts Module**: 
  - Manages user-configured price/indicator alerts.
  - Sends notifications via Chrome API.

## Backend Architecture Details
- **Framework**: NestJS for modular, scalable backend.
- **API Gateway**: Versioned REST APIs (/api/v1/...).
- **Authentication**: 
  - JWT access tokens (short-lived).
  - Refresh tokens (long-lived, stored in HTTP-only cookies).
  - Role-based access control (user, admin).
- **Middleware**: 
  - Authentication, validation, rate limiting, logging.
- **Services** (organized by feature):
  - Auth Service
  - User Service
  - Market Data Service
  - News Service
  - Broker Service
  - Recommendation Service
  - Alert Service
  - Analytics Service
- **Database**: PostgreSQL with TypeORM for ORM.
- **Cache**: Redis for frequently accessed data.
- **External Services**:
  - Market Data APIs (via adapter pattern).
  - News APIs.
  - Broker APIs (OAuth2 flow handled by backend).
  - AI Gateway (Vercel) for LLM interactions.
- **Event Handling**: 
  - Internal NestJS events for loose coupling.
  - Optional: Vercel Queues for durable event processing.
- **Security**:
  - Helmet.js for HTTP headers.
  - Rate limiting via @nestjs/throttler.
  - Data validation via class-validator and class-transformer.
  - Encryption of sensitive data at rest (API keys, secrets).
  - Regular dependency audits.
- **Observability**:
  - Structured logging (winston/pino).
  - Metrics collection (Prometheus).
  - Distributed tracing (Jaeger/OpenTelemetry).
  - Health check endpoints (/health).
- **Testing**:
  - Unit tests with Jest.
  - Integration tests with SuperTest.
  - E2E tests with Playwright.
  - Load testing with k6 or Artillery.
- **DevOps**:
  - Docker containers for consistent environments.
  - CI/CD pipeline (GitHub Actions/GitLab CI).
  - Environment-specific configurations.
  - Blue-green or canary deployments via Vercel/Railway/etc.

## Database Design Principles
- **Normalization**: At least 3NF to reduce redundancy.
- **Indexing**: Strategic indexes on frequently queried columns.
- **Partitioning**: Time-based partitioning for large tables (e.g., market data, history).
- **Backup Strategy**: Regular automated backups.
- **Migration Strategy**: Version-controlled schema migrations.

## Security Considerations
- **Extension Security**:
  - Content Security Policy (CSP) to prevent XSS.
  - Sanitization of all dynamic content.
  - Principle of least permission in manifest.
  - Secure storage of secrets (chrome.storage.session or encrypted storage).
- **Backend Security**:
  - HTTPS enforced.
  - JWT best practices (short expiry, secure storage).
  - Input validation and output encoding.
  - Dependency scanning (npm audit, Snyk).
  - Regular penetration testing.
  - Audit logging for all sensitive operations.
- **Data Privacy**:
  - GDPR/CCPA compliance where applicable.
  - User consent for data collection.
  - Anonymization of analytics data.
  - Right to erasure implementation.

## Scalability Considerations
- **Horizontal Scaling**: Stateless backend services behind load balancer.
- **Caching Strategy**: Multi-level caching (browser extension, Redis, CDN).
- **Database Scaling**: Read replicas, connection pooling, query optimization.
- **Message Queues**: Offload heavy processing to background workers.
- **CDN**: Serve static assets via CDN.
- **Edge Computing**: Consider Vercel Edge Functions for geographic distribution.

## Monitoring & Alerting
- **Infrastructure Monitoring**: CPU, memory, disk, network usage.
- **Application Metrics**: Request latency, error rates, throughput.
- **Business Metrics**: Active users, recommendation accuracy, user engagement.
- **Logging**: Centralized logging (ELK stack or similar).
- **Alerting**: PagerDuty/Slack integrations for critical alerts.
- **Health Checks**: Liveness and readiness probes.

## Development Practices
- **Code Reviews**: Mandatory pull request reviews.
- **Testing**: Minimum 80% code coverage.
- **CI/CD**: Automated testing and deployment on every push.
- **Documentation**: Updated alongside code changes.
- **Feature Flags**: For gradual rollouts.
- **Technical Debt**: Regular refactoring sprints.

## Compliance
- **Financial Regulations**: Where applicable, ensure compliance with local financial advisory regulations (include disclaimers).
- **Accessibility**: WCAG 2.1 AA compliance for extension UI.
- **Data Protection**: Adhere to GDPR, CCPA, and other relevant data protection laws.

## Next Steps
1. Finalize and review this high-level architecture.
2. Proceed to Phase 2: Generate folder structure.
3. Begin implementation following the build roadmap.

---
*Document Version: 1.0*
*Last Updated: 2026-07-25*