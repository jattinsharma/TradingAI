# Backend Architecture

## Overview
The backend for the Universal AI Trading Copilot is a scalable, secure, and maintainable Node.js application built with NestJS. It provides RESTful APIs, handles authentication, processes market data, generates recommendations, and manages user data.

## Architecture Overview

```
Backend Structure:
├── src/
│   ├── app.module.ts          # Root module
│   ├── main.ts                # Entry point
│   ├── config/                # Configuration management
│   ├── common/                # Shared modules, guards, interceptors, pipes
│   │   ├── guards/            # Auth guards, role guards
│   │   ├── interceptors/      # Logging, timeout, transformation
│   │   ├── pipes/             # Validation pipes
│   │   └── exceptions/        # Custom exceptions, filters
│   ├── modules/               # Feature modules
│   │   ├── auth/              # Authentication and authorization
│   │   ├── users/             # User management
│   │   ├── market-data/       # Market data services
│   │   ├── news/              # News and sentiment analysis
│   │   ├── brokers/           # Broker integrations
│   │   ├── recommendations/   # Recommendation engine and history
│   │   ├── alerts/            # Alert management
│   │   ├── watchlists/        # Watchlist management
│   │   ├── settings/          # User settings
│   │   ├── analytics/         # Usage analytics
│   │   └── audit/             # Audit logging
│   ├── providers/             # Reusable services (cache, logger, etc.)
│   ├── utils/                 # Utility functions
│   └── Types/                 # Shared TypeScript interfaces
├── test/                      # Unit and integration tests
├── docs/                      # API documentation
├── migrations/                # Database migrations
├── seeds/                     # Seed data
├── Dockerfile                 # Containerization
├── docker-compose.yml         # Local development
├── nest-cli.json              # NestJS CLI configuration
├── tsconfig.json              # TypeScript configuration
├── .env.example               # Environment variables template
└── README.md
```

## Core Technologies

- **Framework**: NestJS (Progressive Node.js framework)
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL with TypeORM
- **Cache**: Redis (ioredis client)
- **Validation**: class-validator and class-transformer
- **Documentation**: Swagger/OpenAPI (via @nestjs/swagger)
- **Testing**: Jest, SuperTest
- **Logging**: Winston or Pino
- **Environment**: dotenv for configuration management
- **Containerization**: Docker
- **CI/CD**: GitHub Actions (or similar)

## Architectural Layers

### 1. Presentation Layer (Controllers)
- RESTful controllers handling HTTP requests.
- Versioned API endpoints (/api/v1/...).
- Request validation and sanitization.
- Authentication and authorization enforcement.
- Response formatting and error handling.

### 2. Application Layer (Services)
- Business logic encapsulation.
- Transaction management.
- Coordination between repositories and external services.
- Implementation of use cases.
- Event publishing (if using event-driven architecture).

### 3. Domain Layer (Entities & Repositories)
- TypeORM entities representing database tables.
- Repository interfaces for data access.
- Domain services for complex business rules.
- Aggregates and value objects (if following DDD).

### 4. Infrastructure Layer
- Database configuration and connections.
- External service integrations (HTTP clients, messaging).
- Cache implementation.
- File storage (if needed).
- Third-party API wrappers.

### 5. Cross-Cutting Concerns
- Authentication and authorization.
- Logging and monitoring.
- Error handling and exception translation.
- Input validation and output sanitization.
- Configuration management.
- Security headers and protection middleware.

## Key Modules

### 1. Authentication Module (auth/)
- **Responsibilities**:
  - User authentication (login, logout).
  - Token generation (JWT access and refresh tokens).
  - Password hashing and reset.
  - Role-based access control (RBAC).
  - Session management.
  - OAuth 2.0 integration for third-party logins (if applicable).
- **Key Components**:
  - AuthController: Login, logout, refresh, password reset endpoints.
  - AuthService: Authentication logic, token service.
  - JwtStrategy: Passport strategy for JWT verification.
  - LocalStrategy: Username/password authentication.
  - RefreshTokenJwtStrategy: For refresh token validation.
  - RolesGuard: Role-based access control guard.
  - AuthGuard: Authentication guard for protected routes.
- **Security Features**:
  - Bcrypt for password hashing.
  - JWT access tokens (short-lived: 15 minutes).
  - JWT refresh tokens (longer-lived: 7 days, stored HTTP-only).
  - Rate limiting on auth endpoints.
  - Account lockout after failed attempts.
  - Secure cookie settings.

### 2. Users Module (users/)
- **Responsibilities**:
  - User profile management.
  - User preferences and settings.
  - User status (active, suspended, banned).
  - User metadata (created_at, last_login, etc.).
  - GDPR compliance (data export, deletion).
- **Key Components**:
  - UserController: CRUD operations for user profiles.
  - UserService: Business logic for user management.
  - UserEntity: Database model for users.
  - UserRepository: Data access layer.

### 3. Market Data Module (market-data/)
- **Responsibilities**:
  - Fetching and caching real-time and historical market data.
  - Normalizing data from various providers.
  - Providing technical indicator calculations.
  - Managing data provider failover and load balancing.
  - Handling market data subscriptions (WebSocket).
- **Key Components**:
  - MarketDataController: Endpoints for market data retrieval.
  - MarketDataService: Orchestrates data fetching and caching.
  - DataProviderStrategy: Interface for market data providers.
  - Concrete providers: AlphaVantageProvider, PolygonIOProvider, BinanceProvider, etc.
  - CacheService: Redis-based caching layer.
  - WebSocketGateway: Real-time data pushing to extension.
- **Data Flow**:
  1. Extension requests market data via API.
  2. Service checks cache (Redis).
  3. If cache miss/hit expired, fetch from provider.
  4. Cache the result with appropriate TTL.
  5. Return normalized data to extension.
  6. For real-time: Subscribe to provider WebSocket, push updates via SSE/WebSocket to extension.

### 4. News and Sentiment Module (news/)
- **Responsibilities**:
  - Fetching financial news from multiple sources.
  - Performing sentiment analysis on news articles.
  - Identifying market-moving events.
  - Categorizing news by symbol, sector, impact.
  - Providing news-based alerts.
- **Key Components**:
  - NewsController: Endpoints for news retrieval.
  - NewsService: Fetches and processes news.
  - NewsProviderStrategy: Interface for news sources.
  - SentimentAnalyzer: NLP service for sentiment scoring.
  - EventDetector: Identifies significant market events.
  - CacheService: Caches news articles and sentiment scores.

### 5. Broker Module (brokers/)
- **Responsibilities**:
  - Secure connections to brokerage accounts.
  - Account information retrieval (balances, positions).
  - Order placement and management.
  - Trade execution and history.
  - OAuth 2.0 flows for broker authentication.
  - WebSocket connections for real-time account updates.
- **Key Components**:
  - BrokerController: Endpoints for broker operations.
  - BrokerService: Orchestrates broker interactions.
  - BrokerStrategy: Interface for broker integrations.
  - Concrete brokers: BinanceBroker, CoinbaseProBroker, ZerodhaBroker, etc.
  - AuthService: Handles OAuth flows and token refresh.
  - EncryptionService: Encrypts/decrypts API keys and secrets.
  - RateLimiter: Prevents exceeding broker API limits.

### 6. Recommendations Module (recommendations/)
- **Responsibilities**:
  - Storing and retrieving AI-generated recommendations.
  - Managing recommendation history.
  - Calculating recommendation performance metrics.
  - Providing recommendation explanations.
  - Handling user feedback on recommendations.
- **Key Components**:
  - RecommendationController: CRUD operations for recommendations.
  - RecommendationService: Business logic for recommendations.
  - RecommendationEntity: Database model.
  - FeedbackService: Processes user feedback (likes, dismissals, trade outcomes).
  - PerformanceAnalyzer: Calculates win rate, average return, etc.
  - ExplanationGenerator: Creates human-readable explanations.

### 7. Alerts Module (alerts/)
- **Responsibilities**:
  - Managing user-defined alert rules.
  - Evaluating market conditions against alert rules.
  - Triggering notifications when alerts fire.
  - Supporting complex conditions (technical indicators, price, volume).
  - Alert silencing, snoozing, and expiration.
- **Key Components**:
  - AlertController: Alert CRUD and management endpoints.
  - AlertService: Evaluates alerts and manages state.
  - AlertEntity: Database model for alert definitions.
  - AlertTriggerEntity: Records when alerts fire.
  - AlertEvaluatorService: Runs evaluation rules against market data.
  - NotificationService: Sends notifications via email, push, in-app.
  - SchedulerService: Periodic evaluation of active alerts.

### 8. Watchlists Module (watchlists/)
- **Responsibilities**:
  - Managing user-defined symbol watchlists.
  - Tracking watchlist performance.
  - Providing bulk data for watchlist symbols.
  - Enabling quick watchlist switching.
  - Syncing watchlists across devices.
- **Key Components**:
  - WatchlistController: Watchlist and item management.
  - WatchlistService: Business logic for watchlists.
  - WatchlistEntity: Database model for watchlists.
  - WatchlistItemEntity: Symbols within a watchlist.
  - WatchlistPerformanceService: Calculates performance metrics.

### 9. Settings Module (settings/)
- **Responsibilities**:
  - Storing user preferences and configuration.
  - Validating and sanitizing settings.
  - Providing default values.
  - Notifying relevant services of setting changes.
  - Supporting environment-specific settings (dev/staging/prod).
- **Key Components**:
  - SettingsController: CRUD operations for user settings.
  - SettingsService: Validation and business logic.
  - SettingsEntity: Database model for settings.
  - SettingsSchema: JSON Schema for validation.

### 10. Analytics Module (analytics/)
- **Responsibilities**:
  - Tracking user interactions and feature usage.
  - Monitoring system performance and health.
  - Generating usage reports and insights.
  - Supporting A/B testing and feature flags.
  - Exporting analytics data for external analysis.
- **Key Components**:
  - AnalyticsController: Endpoints for ingesting and querying analytics.
  - AnalyticsService: Processes and stores analytics events.
  - EventEntity: Database model for analytics events.
  - AggregationService: Pre-computes metrics for dashboards.
  - ExportService: Generates reports in CSV, JSON, etc.
  - MetricsCollector: Instruments code for performance monitoring.

### 11. Audit Module (audit/)
- **Responsibilities**:
  - Logging all security-relevant and sensitive operations.
  - Maintaining immutable audit trails.
  - Supporting compliance reporting (GDPR, SOX, etc.).
  - Enabling forensic analysis in case of security incidents.
  - Providing audit log viewing and querying capabilities.
- **Key Components**:
  - AuditController: Secure endpoints for audit log access (admin only).
  - AuditService: Logs audit events and manages retention.
  - AuditEntity: Database model for audit logs.
  - AuditLoggerService: Centralized logging of audit events.
  - RetentionPolicy: Automated archival/deletion of old logs.

## Data Flow Examples

### 1. User Authentication Flow
```
1. User submits login credentials via extension popup.
2. Popup sends POST /api/v1/auth/login to backend.
3. AuthController validates input and delegates to AuthService.
4. AuthService verifies credentials against UserRepository.
5. On success:
   - Generates access token (JWT, 15 min expiry).
   - Generates refresh token (JWT, 7 day expiry, stored HTTP-only cookie).
   - Returns access token in response body.
   - Sets refresh token in HTTP-only, Secure, SameSite cookie.
6. Extension stores access token in memory (not localStorage for XSS safety).
7. For subsequent requests, extension sends access token in Authorization header.
8. On token expiry, extension uses refresh token to get new access token.
9. AuthController validates refresh token and issues new pair.
```

### 2. Market Data Request Flow
```
1. Extension requests chart data via GET /api/v1/market-data/{symbol}?timeframe=1h&limit=100.
2. MarketDataController validates parameters and calls MarketDataService.
3. MarketDataService:
   a. Constructs cache key (symbol:timeframe:limit).
   b. Checks Redis cache.
   c. If hit, returns cached data.
   d. If miss:
      i. Selects appropriate DataProvider based on symbol exchange.
      ii. Calls provider's getOHLCV method.
      iii. Transforms response to internal format.
      iv. Caches result with TTL (e.g., 1 minute for real-time, 1 hour for historical).
      v. Returns data to controller.
4. Controller formats response and sends to extension.
5. Extension updates overlay/charts with new data.
```

### 3. Recommendation Generation Flow
```
1. Chart Observer detects new candle or user requests analysis.
2. Extension sends chart data to backend via POST /api/v1/analyze.
3. RecommendationController validates input and delegates to RecommendationService.
4. RecommendationService:
   a. Parses and validates chart data.
   b. Determines required analysis engines based on user settings.
   c. Dispatches analysis tasks to appropriate engines (technical, pattern, etc.).
   d. Collects results from all engines.
   e. Passes results to RecommendationOrchestrator.
   f. Orchestrator combines outputs, applies weights, resolves conflicts.
   g. Generates final recommendation (BUY/SELL/HOLD) with confidence score.
   h. Creates human-readable explanation for each factor.
   i. Stores recommendation in database for history.
   j. Returns recommendation to extension.
5. Extension displays recommendation in popup/overlay.
6. User can accept/reject or save to watchlist.
7. Extension sends feedback to backend via POST /api/v1/recommendations/{id}/feedback.
```

## API Design Principles

### 1. RESTful Design
- Resource-based URLs (nouns, not verbs).
- Proper HTTP methods (GET, POST, PUT, PATCH, DELETE).
- Consistent status codes (200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 429 Too Many Requests, 500 Internal Server Error).
- Versioned API (/api/v1/...).
- Resource nesting for hierarchical relationships (/users/{id}/watchlists).
- Pagination, filtering, and sorting for list endpoints.
- HATEOAS links where beneficial.

### 2. Request/Response Format
- JSON for all request/response bodies.
- ISO 8601 timestamps for date/time fields.
- Consistent error response format:
  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Validation failed",
      "details": [
        {
          "field": "email",
          "message": "Email is required"
        }
      ]
    }
  }
  ```
- Success responses wrap data:
  ```json
  {
    "data": {
      // resource data
    },
    "meta": {
      // pagination info, timestamps, etc.
    }
  }
  ```

### 3. Security
- HTTPS enforced in production.
- All endpoints require authentication unless explicitly public.
- Input validation on all endpoints using class-validator.
- Output sanitization to prevent XSS.
- Rate limiting per IP and user.
- CSRF protection for cookie-based auth (if used).
- Security headers via helmet.js.

### 4. Documentation
- OpenAPI 3.0 specification generated via @nestjs/swagger.
- Interactive Swagger UI available at /api/docs.
- Clear examples for request/response bodies.
- Detailed descriptions for endpoints and parameters.
- Authentication schemes documented (Bearer token).
- Error responses documented.

## Database Design

### 1. Technology Choice
- **Primary**: PostgreSQL 15+ for relational data.
- **Justification**: ACID compliance, rich data types, JSONB support, excellent performance, mature ecosystem.
- **ORM**: TypeORM for TypeScript compatibility and decorator-based mapping.
- **Alternative Considered**: MongoDB (rejected due to transaction requirements and consistency needs).

### 2. Connection Management
- Connection pool via TypeORM (default: 10 connections).
- Pool size configurable via environment variables.
- Idle timeout and connection lifetime settings.
- Health check endpoint for database connectivity.
- Retry logic for transient connection failures.

### 3. Schema Design Principles
- **Normalization**: 3NF to eliminate redundancy and ensure data integrity.
- **Indexing**: Strategic indexes on frequently queried columns (foreign keys, timestamps, search fields).
- **Partitioning**: Time-based partitioning for large tables (market data, history, audit logs).
- **Soft Deletes**: Used where historical tracking is needed (users, settings).
- **Encryption**: Sensitive fields encrypted at rest (API keys, tokens).
- **Auditing**: Auto-generated created_at, updated_at, created_by, updated_by.
- **UUIDs**: Used for public-facing IDs to prevent enumeration.
- **Timestamps**: All timestamps stored in UTC with timezone conversion at presentation layer.

### 4. Key Tables
- **users**: id, email, password_hash, first_name, last_name, status, created_at, updated_at, last_login_at
- **user_profiles**: user_id, avatar_url, bio, preferences (JSONB), settings (JSONB)
- **watchlists**: id, user_id, name, description, created_at, updated_at
- **watchlist_items**: id, watchlist_id, symbol, exchange, added_at
- **recommendations**: id, user_id, symbol, timeframe, recommendation_type, confidence, reasoning (JSONB), created_at, expires_at
- **recommendation_feedback**: id, recommendation_id, user_id, feedback_type (like/dislike/ignore), trade_result (profit/loss/breakeven), profit_loss_pct, created_at
- **alerts**: id, user_id, name, description, conditions (JSONB), is_active, created_at, updated_at, last_triggered_at
- **alert_triggers**: id, alert_id, triggered_at, price_at_trigger, metadata (JSONB)
- **api_keys**: id, user_id, provider (exchange/broker name), encrypted_key, encrypted_secret, created_at, last_used_at, expires_at
- **audit_logs**: id, user_id, action, resource_type, resource_id, changes (JSONB), ip_address, user_agent, created_at
- **sessions**: id, user_id, token_hash, expires_at, user_agent, ip_address, created_at
- **market_data_cache**: id, symbol, timeframe, data_type, data (JSONB), expires_at
- **news_articles**: id, source, title, content, url, published_at, sentiment_score, entities (JSONB), symbols (JSONB), created_at
- **analytics_events**: id, user_id, session_id, event_type, properties (JSONB), timestamp
- **api_rate_limits**: id, identifier, endpoint, window_start, request_count

### 5. Migration Strategy
- Version-controlled migrations using TypeORM CLI or similar.
- Each migration is timestamped and immutable.
- Up/down functions for forward and backward compatibility.
- Data migration scripts for complex schema changes.
- Testing migrations against copy of production data.
- Automated migration execution in CI/CD pipeline.
- Rollback plan for failed production migrations.

## Caching Strategy

### 1. Cache Technology
- **Primary**: Redis 7+ for distributed caching.
- **Why Redis**: Speed, rich data types, persistence options, pub/sub, clustering support.
- **Alternative Considered**: Memcached (rejected due to lack of persistence and data structures).

### 2. Cache Layers
- **L1 Browser Cache**: Extension-level caching for UI state and non-critical data.
- **L2 Application Cache**: Redis for shared, frequently accessed data.
- **L3 Database**: PostgreSQL for persistent storage.

### 3. Cached Data Types
- **Market Data**: OHLCV, tickers, order books (short TTL: 1s-5min).
- **Technical Indicators**: Pre-calculated indicators (medium TTL: 5min-1hr).
- **News Articles**: Latest news with sentiment (medium TTL: 5min-30min).
- **User Sessions**: Active sessions (long TTL: 24h, tied to JWT expiry).
- **API Responses**: Expensive computations (variable TTL based on data volatility).
- **Configuration**: Static configuration data (long TTL: 24h+).
- **Rate Limit Counters**: Request counters per IP/user (short TTL: 1min-1hr).

### 4. Cache Patterns
- **Cache-Aside**: Application reads from cache, falls back to DB, then writes back.
- **Write-Through**: Critical updates go to DB and cache simultaneously.
- **Write-Behind**: Batch writes to DB for non-critical data (with risk consideration).
- **Cache Invalidation**: Explicit deletion on update/delete events.
- **TTL-Based Expiration**: Automatic cleanup based on time.
- **Event-Based Invalidation**: Clear cache on specific events (e.g., new market data).

### 5. Implementation Details
- **Client**: ioredis for Redis connection pooling.
- **Wrapper Service**: CacheService with get/set/delete methods.
- **Key Naming**: Consistent naming convention (e.g., `market:{symbol}:{timeframe}:{data_type}`).
- **Serialization**: JSON for complex data, strings for simple values.
- **Compression**: Consider LZ4 for large payloads (configuration-dependent).
- **Monitoring**: Track cache hit/miss ratios, memory usage, eviction rates.
- **Fallback**: Graceful degradation to database if Redis unavailable.

## Security Measures

### 1. Authentication & Authorization
- **JWT Best Practices**:
  - Short-lived access tokens (15 minutes).
  - Refresh token rotation to prevent replay attacks.
  - Secure storage of refresh tokens (HTTP-only, Secure, SameSite cookies).
  - Token blacklisting on logout/password change.
  - Strong secret keys (minimum 32 bytes, stored in environment).
- **Password Security**:
  - Bcrypt with cost factor 12+.
  - Password strength requirements (min length, complexity).
  - Rate limiting on authentication endpoints.
  - Account lockout after 5 failed attempts (temporary or CAPTCHA).
  - Secure password reset with time-limited tokens.
- **Session Management**:
  - Server-side session tracking for sensitive operations.
  - Session invalidation on password change.
  - Concurrent session limits (configurable).
  - Session timeout based on inactivity.
- **Authorization**:
  - Role-Based Access Control (RBAC) with roles: user, premium_user, admin.
  - Resource-based ownership checks (users can only access their own data).
  - Attribute-Based Access Control (ABAC) for complex policies.
  - Permission decorators for endpoint-level protection.
  - Regular permission audits.

### 2. Data Protection
- **Encryption at Rest**:
  - AES-256-GCM for sensitive fields (API keys, secrets, PII).
  - Key management via environment variables or HashiCorp Vault.
  - Separate keys for different data types.
  - Key rotation strategy.
- **Encryption in Transit**:
  - TLS 1.3 enforced for all external connections.
  - HSTS headers for web interfaces.
  - Certificate pinning for critical third-party APIs.
- **Data Minimization**:
  - Collect only necessary data for functionality.
  - Pseudonymization where possible.
  - Data retention policies with automated deletion.
- **Privacy Controls**:
  - User consent for data collection.
  - Right to access, rectify, and delete personal data.
  - Data portability exports (JSON format).
  - Privacy-by-design in feature development.

### 3. Input Validation & Output Sanitization
- **Validation**:
  - Strict schema validation on all inputs (class-validator).
  - Whitelist approach for allowed values.
  - Length limits on all string inputs.
  - Type checking and conversion.
  - Custom validators for complex rules (e.g., valid trading symbol).
- **Sanitization**:
  - Output encoding for HTML contexts (if any HTML served).
  - SQL injection prevention via parameterized queries (TypeORM).
  - NoSQL injection prevention (if applicable).
  - Command injection prevention (avoid shell commands).
  - Path traversal prevention (validate file paths).
- **Content Security**:
  - CSP headers to prevent XSS.
  - X-Frame-Options to prevent clickjacking.
  - X-Content-Type-Options to prevent MIME sniffing.
  - Referrer-Policy to control referrer information.
  - Permissions-Policy to restrict browser features.

### 4. Network & Infrastructure Security
- **API Security**:
  - Rate limiting (100 requests/minute per IP, 1000/user/hour).
  - Burst protection with leaky bucket algorithm.
  - IP allowlisting for admin interfaces (optional).
  - Geographic restrictions if needed (via cloud firewall).
  - API versioning to prevent breaking changes.
- **Network Segmentation**:
  - Private subnets for databases and caching.
  - Public-facing load balancers only.
  - Security groups limiting port exposure.
  - VPC peering for inter-service communication (if microservices).
- **Monitoring & Detection**:
  - Intrusion detection systems (IDS) for network anomalies.
  - Web Application Firewall (WAF) for common attacks.
  - Security information and event management (SIEM) for log aggregation.
  - Regular vulnerability scanning (dependencies, containers).
  - Penetration testing schedule (quarterly or bi-annual).
  - Bug bounty program for external security testing.

## Scalability & Performance

### 1. Horizontal Scaling
- **Stateless Services**: All microservices designed to be stateless.
- **Load Balancing**: Round-robin or least connections via NGINX or cloud LB.
- **Session Affinity**: Avoid where possible; use token-based auth or sticky sessions if needed.
- **Database Read Replicas**: For read-heavy workloads (analytics, reporting).
- **Connection Pooling**: Properly sized pools to prevent exhaustion.
- **Caching Layers**: Redis clustering for distributed cache.
- **Message Queues**: For decoupling and buffering (e.g., RabbitMQ, Apache Kafka).

### 2. Vertical Scaling
- **Resource Allocation**: CPU and memory optimized per service type.
- **Vertical Pod Autoscaler** (if Kubernetes): Automatic resource adjustment.
- **Database Vertical Scaling**: Upgrade instance size as needed.
- **Optimize Queries**: Index usage, query planning, explain analysis.

### 3. Performance Optimization
- **Database**:
  - Index covering for frequent queries.
  - Materialized views for complex aggregations.
  - Read replicas for distribution.
  - Connection pooling tuned to workload.
  - Query caching where appropriate.
- **Application**:
  - Async/await for non-blocking I/O.
  - Worker threads for CPU-intensive tasks (crypto, image processing).
  - Object pooling for frequent allocations.
  - Efficient serialization (Protocol Buffers or MsgPack for internal services).
  - Lazy loading of resources.
- **Network**:
  - HTTP/2 where supported.
  - Response compression (gzip/brotli).
  - CDN for static assets (if serving any).
  - Edge computing for geographically distributed users.
- **Frontend**:
  - Code splitting and lazy loading.
  - Asset optimization (images, fonts).
  - Service workers for caching.
  - Efficient re-rendering (React memo, useMemo).
  - Virtual scrolling for large lists.

### 4. Load Testing & Benchmarking
- **Tools**: k6, Artillery, Locust, or JMeter.
- **Scenarios**:
  - Peak concurrent users (simulate market open/close).
  - Sustained load (trading hours).
  - Spike loads (news events).
  - Long-running tests (memory leaks).
- **Metrics**:
  - Response times (p50, p90, p99).
  - Throughput (requests/second).
  - Error rates.
  - Resource utilization (CPU, memory, disk, network).
  - Database connection usage.
  - Cache hit/miss ratios.
- **Acceptance Criteria**:
  - 95% of requests < 500ms under normal load.
  - 99% of requests < 2000ms under peak load.
  - Error rate < 0.1%.
  - No memory leaks over 24-hour test.

## Reliability & Fault Tolerance

### 1. Resilience Patterns
- **Circuit Breaker**: For external dependencies (market data providers, brokers).
  - Libraries: opossum or oxide.
  - Fail fast when service is degraded.
  - Half-open state for recovery testing.
- **Retry Logic**: With exponential backoff and jitter.
  - Idempotency consideration for retries.
  - Maximum retry attempts to prevent storm.
- **Bulkhead**: Isolate critical resources (thread pools, semaphores).
- **Rate Limiter**: Protect downstream services from traffic spikes.
- **Timeouts**: Configurable timeouts for all external calls.
- **Fallbacks**: Default responses or cached data when services unavailable.

### 2. Data Durability
- **Database Replication**:
  - Primary-replica setup for automatic failover.
  - Synchronous replication for critical data (if performance allows).
  - Asynchronous replica for read scaling.
- **Backup Strategy**:
  - Daily full backups.
  - Hourly transaction log backups.
  - Point-in-time recovery capability.
  - Cross-region backup storage.
  - Regular restore testing (monthly).
- **Cache Persistence**:
  - RDB snapshots every 5 minutes.
  - AOF logging for durability.
  - Redis persistence configuration tuned for use case.
- **Message Queue Durability**:
  - Persistent queues for critical workflows.
  - Dead letter queues for failed messages.
  - Message acknowledgment to prevent loss.

### 3. Disaster Recovery
- **Multi-Region Deployment**:
  - Active-passive or active-active across regions.
  - DNS failover with health checks.
  - Data replication across regions.
  - Recovery Time Objective (RTO): < 30 minutes.
  - Recovery Point Objective (RPO): < 5 minutes.
- **Backup Sites**:
  - Cold standby for critical services.
  - Warm standby for user-facing services.
  - Regular drills (quarterly).
- **Data Archival**:
  - Long-term storage for compliance (Glacier or similar).
  - Immutable storage for audit logs.
  - Retention policies aligned with regulatory requirements.

### 4. Observability for Reliability
- **Health Checks**:
  - Liveness probe: Is the service running?
  - Readiness probe: Is the service ready to traffic?
  - Dependency checks: Database, cache, external APIs.
- **Metrics**:
  - RED metrics: Rate, Errors, Duration.
  - USE metrics: Utilization, Saturation, Errors (for resources).
  - Business metrics: Active users, recommendation accuracy.
- **Logging**:
  - Structured JSON logging.
  - Correlation IDs for request tracing.
  - Log levels: debug, info, warn, error, fatal.
  - Centralized aggregation (ELK stack or similar).
- **Alerting**:
  - Threshold-based alerts (error rate > 1%, latency > 1s p95).
  - Anomaly detection for unusual patterns.
  - Escalation policies and on-call rotations.
  - Runbooks for common incident types.

## Development & Deployment

### 1. Development Environment
- **Local Development**:
  - Docker-compose for service orchestration.
  - Hot reloading for frontend components.
  - Database migrations via CLI.
  - Mock services for external dependencies.
  - Pre-commit hooks for linting and testing.
- **Code Quality**:
  - ESLint with TypeScript plugin.
  - Prettier for code formatting.
  - Husky for git hooks.
  - lint-staged for staged file linting.
  - CircleCI or GitHub Actions for CI.
- **Testing**:
  - Unit tests: Jest with coverage > 80%.
  - Integration tests: SuperTest for API endpoints.
  - Contract tests: Pact for service interactions.
  - End-to-end tests: Cypress or Playwright for critical flows.
  - Test data factories: Factory-boy or similar.
  - Test reporting: Jest HTML report, coverage badge.

### 2. Build Process
- **Containerization**:
  - Multi-stage Docker builds for small images.
  - Non-root user for security.
  - Healthcheck instruction in Dockerfile.
  - Label schema for image metadata.
- **Artifact Management**:
  - Private container registry (ECR, GCR, Harbor).
  - Image signing and verification (cosign).
  - Vulnerability scanning (Trivy, Snyk).
  - Base image updates (dependabot or similar).
- **Configuration Management**:
  - Environment-specific .env files.
  - Configuration validation at startup.
  - Feature flags via launchdarkly or similar.
  - Secrets management via Doppler, HashiCorp Vault, or cloud secrets manager.
- **Infrastructure as Code**:
  - Terraform or Pulumi for cloud resources.
  - Kubernetes manifests for orchestration.
  - Helm charts for complex deployments.
  - Version-controlled in same repo as code.

### 3. Deployment Strategy
- **CI/CD Pipeline**:
  - Triggered on push to main branch.
  - Steps: checkout, lint, test, build, scan, deploy.
  - Blue-green deployment for zero-downtime releases.
  - Canary releases for risk mitigation.
  - Feature flags for gradual rollout.
  - Rollback automation on health check failures.
- **Environment Promotion**:
  - Development: Latest commit from feature branches.
  - Staging: Release candidate from main.
  - Production: Tagged releases after staging approval.
- **Database Migrations**:
  - Automated as part of deployment pipeline.
  - Pre-deployment validation against staging copy.
  - Post-deployment verification.
  - Rollback scripts for failed migrations.
- **Configuration Changes**:
  - Separate from code deployments when possible.
  - Feature flags for risky config changes.
  - Blue-green for config-only updates.

### 4. Rollback & Recovery
- **Automatic Rollback**:
  - Health checks fail after deployment.
  - Metrics degrade beyond thresholds.
  - Manual trigger via dashboard or CLI.
- **Rollback Process**:
  - Switch traffic to previous version.
  - Restore configuration if changed.
  - Do NOT rollback database migrations (forward-only).
  - Compensating transactions for data changes if needed.
- **Post-Incident Review**:
  - Timeline reconstruction from logs.
  - Root cause analysis (5 Whys).
  - Action items for prevention.
  - Update runbooks and documentation.
  - Blame-free culture emphasis.

## API Contracts (Examples)

### 1. Authentication Endpoints
```
POST /api/v1/auth/login
  Request: {
    email: string (email),
    password: string (min 8 chars)
  }
  Success Response:
    Status: 200 OK
    Body: {
      data: {
        access_token: string (JWT),
        expires_in: number (seconds)
      }
    }
    Headers: Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Strict
  Error Responses:
    400 Bad Request: Invalid input
    401 Unauthorized: Invalid credentials
    429 Too Many Requests: Rate limit exceeded

POST /api/v1/auth/refresh
  Request: Cookie: refresh_token=...
  Success Response:
    Status: 200 OK
    Body: {
      data: {
        access_token: string (JWT),
        expires_in: number (seconds)
      }
    }
    Headers: Set-Cookie: new_refresh_token=...; HttpOnly; Secure; SameSite=Strict
  Error Responses:
    401 Unauthorized: Invalid or expired refresh token
    403 Forbidden: Token revoked

POST /api/v1/auth/logout
  Request: Cookie: refresh_token=...
  Success Response:
    Status: 200 OK
    Body: {
      data: {
        message: "Logged out successfully"
      }
    }
    Headers: Set-Cookie: refresh_token=; Max-Age=0; HttpOnly; Secure; SameSite=Strict
```

### 2. Market Data Endpoints
```
GET /api/v1/market-data/{symbol}
  Query Parameters:
    timeframe: enum [1m, 5m, 15m, 1h, 4h, 1d, 1w, 1M] (default: 1h)
    limit: integer [1-1000] (default: 100)
    start_time: ISO 8601 timestamp (optional)
    end_time: ISO 8601 timestamp (optional)
  Success Response:
    Status: 200 OK
    Body: {
      data: [
        {
          timestamp: string (ISO 8601),
          open: number,
          high: number,
          low: number,
          close: number,
          volume: number
        }
      ],
      meta: {
        symbol: string,
        timeframe: string,
        count: number
      }
    }
  Error Responses:
    400 Bad Request: Invalid symbol or parameters
    404 Not Found: No data available for symbol/timeframe
    429 Too Many Requests: Rate limit exceeded

GET /api/v1/market-data/{symbol}/indicators
  Query Parameters:
    indicators: comma-separated string [sma, ema, rsi, macd, bollinger] (default: all)
    timeframe: string (default: 1h)
    limit: integer [1-100] (default: 50)
  Success Response:
    Body: {
      data: {
        symbol: string,
        timeframe: string,
        indicators: {
          sma: [{ timestamp: string, value: number }],
          rsi: [{ timestamp: string, value: number }],
          ...
        }
      }
    }
```

### 3. Recommendation Endpoints
```
POST /api/v1/analyze
  Request Body:
    {
      symbol: string (required),
      timeframe: string (required),
      candles: Array<{timestamp, open, high, low, close, volume}> (required),
      indicators?: Record<string, number[]> (optional),
      user_id: string (optional, for personalization)
    }
  Success Response:
    Status: 200 OK
    Body: {
      data: {
        id: string (UUID),
        symbol: string,
        timeframe: string,
        timestamp: string (ISO 8601),
        recommendation: enum [BUY, SELL, HOLD, STRONG_BUY, STRONG_SELL],
        confidence: number [0-1],
        reasoning: {
          technical: {
            signal: string,
            strength: number [0-1],
            details: string
          },
          pattern: {
            detected: boolean,
            name: string | null,
            confidence: number [0-1]
          },
          trend: {
            direction: string [up, down, sideways],
            strength: number [0-1]
          },
          // ... other analysis components
        }
      }
    }
  Error Responses:
    400 Bad Request: Invalid input data
    422 Unprocessable Entity: Insufficient data for analysis
    429 Too Many Requests: Rate limit exceeded

GET /api/v1/recommendations/history
  Query Parameters:
    symbol: string (optional)
    start_date: ISO 8601 date (optional)
    end_date: ISO 8601 date (optional)
    limit: integer [1-100] (default: 50)
    offset: integer [0-∞] (default: 0)
  Success Response:
    Body: {
      data: [
        {
          id: string,
          symbol: string,
          recommendation: string,
          timestamp: string,
          outcome: string | null (profit/loss/breakeven/pending),
          profit_loss_pct: number | null
        }
      ],
      meta: {
        total: number,
        limit: number,
        offset: number
      }
    }
```

## Environment Configuration

### 1. Environment Variables
```
# Server
PORT=3000
NODE_ENV=development

# Database
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=secure_password
DB_NAME=trading_copilot
DB_SCHEMA=public

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_password

# JWT
JWT_ACCESS_SECRET=super_secret_access_key_min_32_bytes
JWT_REFRESH_SECRET=super_secret_refresh_key_min_32_bytes
JWT_ACCESS_EXPIRATION_MS=900000  # 15 minutes
JWT_REFRESH_EXPIRATION_MS=604800000  # 7 days

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000  # 1 minute
RATE_LIMIT_MAX_REQUESTS=100

# Third-party APIs (examples)
ALPHA_VANTAGE_API_KEY=your_key_here
POLYGON_API_KEY=your_key_here
BINANCE_API_KEY=your_key_here
BINANCE_SECRET_KEY=your_key_here
NEWSAPI_KEY=your_key_here

# Mail (for notifications)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user
SMTP_PASS=password
FROM_EMAIL=noreply@tradingcopilot.com

# Feature Flags
FEATURE_ADVANCED_ANALYTICS=true
FEATURE_SOCIAL_TRADING=false

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Sentry (error monitoring)
SENTRY_DSN=https://example@o1.ingest.sentry.io/123456
```

### 2. Configuration Validation
- Schema validation using zod or Joi at startup.
- Default values for optional settings.
- Clear error messages for missing/invalid configs.
- Environment-specific validation (e.g., stricter in production).
- Secrets never logged or exposed in error messages.

## Monitoring & Observability

### 1. Metrics Collection
- **Application Metrics** (via Prometheus client):
  - HTTP request duration, rate, errors (by endpoint, method, status).
  - Database query duration and count.
  - External API call latency and failure rates.
  - Cache hit/miss ratios.
  - Business metrics: active users, recommendations generated, alerts triggered.
- **System Metrics** (via node_exporter or similar):
  - CPU usage, memory consumption, disk I/O, network I/O.
  - Process-specific metrics: file descriptors, event loop delay.
- **Custom Metrics**:
  - Recommendation accuracy over time.
  - User engagement metrics (session length, feature usage).
  - Data freshness latency (time from market update to analysis).

### 2. Logging
- **Structured Logging**: JSON format for easy parsing.
- **Log Levels**:
  - error: System errors requiring immediate attention.
  - warn: Potentially harmful situations.
  - info: General operational events.
  - debug: Detailed information for troubleshooting.
  - trace: Very detailed information (development only).
- **Log Fields**:
  - timestamp: ISO 8601 with timezone.
  - level: Log level string.
  - message: Human-readable description.
  - service: Service name (auth, market-data, etc.).
  - trace_id: Unique ID for request tracing.
  - span_id: ID for distributed tracing spans.
  - user_id: Anonymized or hashed user ID (if applicable).
  - request_id: Unique ID for HTTP request.
  - host: Hostname where log originated.
- **Log Destinations**:
  - Console for development.
  - File rotation for staging (size-based or time-based).
  - Centralized ELK stack or similar for production.
  - Separate audit log stream for compliance.

### 3. Tracing
- **Distributed Tracing**: OpenTelemetry or AWS X-Ray.
- **Trace Propagation**: W3C TraceContext format.
- **Spans**:
  - Incoming HTTP requests.
  - Database queries.
  - External HTTP calls.
  - Cache operations.
  - Message queue publishes/consumes.
- **Attributes**:
  - HTTP method, URL, status code.
  - Database query type and table.
  - External service name and endpoint.
  - Error information if applicable.
- **Integration**:
  - Automatic instrumentation for common libraries.
  - Manual spans for custom operations.
  - Export to Jaeger, Zipkin, or cloud provider's tracing service.

### 4. Health Checks
- **Liveness Probe**:
  - Simple endpoint to check if process is running.
  - `/health/live` returns 200 if process responsive.
- **Readiness Probe**:
  - Checks dependencies: database, cache, critical services.
  - `/health/ready` returns 200 if ready to serve traffic.
  - Returns 503 if any dependency unhealthy.
- **Startup Probe**:
  - For slow-starting applications.
  - `/health/start` returns 200 when application initialized.
- **Dependency Checks**:
  - Database: Simple query (SELECT 1).
  - Redis: PING command.
  - External APIs: Lightweight endpoint or ping.
  - Disk space: Check available space > threshold.
  - Memory: Check available memory > threshold.

### 5. Alerting Rules
- **Infrastructure Alerts**:
  - CPU usage > 85% for 5 minutes.
  - Memory usage > 90% for 5 minutes.
  - Disk space < 10% free.
  - Database connection pool exhaustion.
  - Redis memory usage > 80%.
- **Application Alerts**:
  - Error rate > 1% for 5 minutes.
  - 95th percentile latency > 1 second for 5 minutes.
  - Failed dependency health checks.
  - Queue depth > 1000 messages.
  - Scheduled job failures.
- **Business Alerts**:
  - Sudden drop in active users (>50% drop in 10 minutes).
  - Recommendation generation rate drops to zero.
  - Alert system not firing (stale data).
  - Payment processing failures.
- **Notification Channels**:
  - Email for non-critical alerts.
  - Slack/MS Teams for urgent alerts.
  - PagerDuty for critical, page-worthy alerts.
  - Webhook for custom integrations.

## Compliance & Auditing

### 1. Data Protection Regulations
- **GDPR** (if processing EU resident data):
  - Lawful basis for processing (consent, legitimate interest).
  - Data subject access request (DSAR) fulfillment.
  - Right to rectification and erasure.
  - Data portability exports.
  - Privacy impact assessments for new features.
  - Data processing agreements with subprocessors.
- **CCPA/CPRA** (if processing California resident data):
  - Right to know what personal information is collected.
  - Right to delete personal information.
  - Right to opt-out of sale of personal information.
  - Non-discrimination for exercising privacy rights.
- **Data Minimization**:
  - Collect only necessary data for service provision.
  - Pseudonymize data where possible.
  - Regular data reviews to delete unnecessary data.
- **Consent Management**:
  - Granular consent options for different data uses.
  - Easy withdrawal of consent.
  - Proof of consent storage and retrieval.

### 2. Financial Regulations
- **Investment Advice Disclaimer**:
  - Clear disclaimer that tool provides analysis, not advice.
  - Encouragement to consult financial professionals.
  - No guarantee of performance or accuracy.
- **Data Accuracy**:
  - Source attribution for market data and news.
  - Timestamping of all data.
  - Known limitations disclosure.
- **Market Abuse Prevention**:
  - No facilitation of insider trading or market manipulation.
  - Monitoring for suspicious usage patterns.
  - Cooperation with regulatory requests.
- **Record Keeping**:
  - Retention of communications and advice (if applicable).
  - Secure storage of audit trails.
  - Regular backups of critical records.

### 3. Accessibility (for any web interfaces)
- **WCAG 2.1 AA Compliance**:
  - Keyboard navigation.
  - Screen reader support.
  - Color contrast ratios.
  - Resizable text.
  - Error identification and suggestions.
  - Consistent navigation.
- **Testing**:
  - Automated axe-core testing.
  - Manual testing with assistive technologies.
  - User testing with diverse abilities.

### 4. Audit Logging
- **Events to Log**:
  - Authentication events (login, logout, failed attempts).
  - Authorization decisions (access granted/denied).
  - Data access (read, write, delete on sensitive data).
  - Configuration changes (security settings, feature flags).
  - Privileged operations (admin actions, system changes).
  - Data exports and deletions.
  - Third-party API key usage.
  - Failed security events (brute force, SQLi attempts).
- **Log Details**:
  - Who (user ID or service account).
  - What (action performed).
  - When (timestamp).
  - Where (IP address, user agent).
  - Outcome (success/failure).
  - Before/after states (for changes).
  - Reason (if applicable, e.g., business justification).
- **Log Protection**:
  - Write-once storage where possible.
  - Regular backup and integrity checks.
  - Access restricted to authorized personnel only.
  - Retention aligned with legal and regulatory requirements.
  - Regular review for anomalous patterns.

## Documentation

### 1. API Documentation
- **OpenAPI/Swagger**:
  - Auto-generated from NestJS decorators.
  - Hosted at /api/docs with Swagger UI.
  - Includes authentication schemes.
  - Shows example requests and responses.
  - Markdown descriptions for endpoints and models.
  - Versioned alongside API versions.
- **Postman Collection**:
  - Exported from OpenAPI spec.
  - Includes environment variables.
  - Pre-authorized requests for easy testing.
- **Change Log**:
  - Maintained in CHANGELOG.md.
  - Follows Keep a Changelog format.
  - Versioned with semantic versioning.

### 2. Developer Documentation
- **Onboarding Guide**:
  - Setting up development environment.
  - Running tests and linters.
  - Common development tasks.
  - Troubleshooting guide.
- **Architecture Documents**:
  - This architecture document.
  - Data flow diagrams.
  - Database schema documentation.
  - API design guidelines.
- **Code Documentation**:
  - JSDoc/Typedoc for all public APIs.
  - Inline comments for complex logic.
  - README.md in each directory.
- **Deployment Guide**:
  - CI/CD pipeline explanation.
  - Environment setup instructions.
  - Rollback procedures.
  - Scaling guidelines.

### 3. User Documentation
- **User Guests**:
  - How to install and use the extension.
  - Feature walkthroughs with screenshots.
  - Troubleshooting common issues.
  - FAQ section.
- **Administrator Guide**:
  - Managing user roles and permissions.
  - Configuring system settings.
  - Monitoring and maintenance procedures.
  - Backup and recovery instructions.
- **Security Documentation**:
  - Data handling and privacy policy.
  - Incident response procedures.
  - Vulnerability reporting process.
  - Compliance certifications and attestations.

## Future Enhancements

### 1. Technical Improvements
- **Microservices Migration**:
  - Split monolith into domain-specific services.
  - Event-driven architecture with Kafka or RabbitMQ.
  - API Gateway for request routing and composition.
  - Shared kernel for common utilities.
- **Service Mesh**:
  - Istio or Linkerd for traffic management.
  - Mutual TLS for service-to-service security.
  - Observability enhancements (distributed tracing, metrics).
- **Serverless Components**:
  - AWS Lambda or Cloudflare Workers for sporadic tasks.
  - Event-driven processing (image/video analysis).
  - API Gateway for HTTP-triggered functions.
- **Edge Computing**:
  - Cloudflare Workers or AWS Lambda@Edge for geolocation-based routing.
  - Cached responses at edge for static data.
  - Prime content delivery for global users.
- **Database Optimization**:
  - Read replicas for geographical distribution.
  - Sharding strategy for horizontal scaling.
  - Columnar storage for analytics workloads.
  - In-memory database (Redis) for hot data.

### 2. Feature Extensions
- **Advanced Analytics**:
  - Machine learning models for pattern recognition.
  - Sentiment analysis from social media and forums.
  - On-chain cryptocurrency analytics.
  - Macro-economic indicator integration.
- **Social Trading**:
  - Copy trading functionality (with consent).
  - Community sentiment indicators.
  - Leaderboards and reputation systems.
  - Discussion forums and chat rooms.
- **Portfolio Management**:
  - Automated portfolio rebalancing.
  - Tax-loss harvesting algorithms.
  - Risk parity optimization.
  - Goal-based investing tools.
- **Integration Expansion**:
  - Additional brokerages (Interactive Brokers, TD Ameritrade, etc.).
  - More cryptocurrency exchanges.
  - Traditional stock exchanges (NYSE, NASDAQ, LSE, etc.).
  - Commodity and futures markets.
  - Forex and CFD platforms.
- **Payment & Subscription**:
  - Premium subscription tiers.
  - Marketplace for third-party plugins.
  - In-app purchases for extra features.
  - Affiliate programs and referral systems.

### 3. DevOps & Operations
- **GitOps**:
  - Argo CD or Flux for Kubernetes deployments.
  - Declarative infrastructure management.
  - Automated sync from Git repository.
- **Chaos Engineering**:
  - Regular fault injection experiments.
  - Gremlin or LitmusChaos for resilience testing.
  - GameDays for incident response practice.
- **Advanced Monitoring**:
  - Predictive analytics for capacity planning.
  - AI-driven anomaly detection.
  - Service level objective (SLO) tracking.
  - User experience monitoring (Real User Monitoring).
- **Security Enhancements**:
  - Zero trust architecture implementation.
  - Hardware security modules (HSM) for key management.
  - Continuous compliance monitoring.
  - Automated penetration testing in CI/CD.

### 4. Research & Innovation
- **Quantum Computing**:
  - Post-quantum cryptography preparation.
  - Quantum-resistant algorithms for future-proofing.
- **Edge AI**:
  - On-device model inference for privacy.
  - Federated learning for collaborative model improvement.
- **Natural Language Processing**:
  - Conversational interface for querying markets.
  - Automated report generation in natural language.
  - Multilingual support for global users.
- **Augmented Reality/Virtual Reality**:
  - Immersive trading environments.
  - Spatial data visualization.
  - Voice-controlled trading interfaces.

## Conclusion

This backend architecture provides a solid foundation for a scalable, secure, and maintainable trading copilot application. By following established patterns and best practices, the system is designed to handle growth, resist failures, and adapt to changing requirements. The modular design ensures that individual components can be updated or replaced without affecting the entire system, enabling continuous improvement and innovation.

---
*Document Version: 1.0*
*Last Updated: 2026-07-25