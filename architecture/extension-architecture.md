# Extension Architecture

## Overview
The Universal AI Trading Copilot browser extension is built using Manifest V3, React, TypeScript, and Tailwind CSS. It follows a modular architecture with clear separation of concerns between different parts of the extension.

## Architecture Overview

```
Extension Structure:
├── manifest.json
├── src/
│   ├── background/          # Service worker scripts
│   ├── content-scripts/     # Content scripts injected into web pages
│   ├── popup/               # Popup UI (React)
│   ├── overlay/             # Overlay UI (React)
│   ├── shared/              # Shared types, utilities, constants
│   ├── modules/             # Feature modules
│   │   ├── adapter-manager/
│   │   ├── website-detector/
│   │   ├── chart-observer/
│   │   ├── analysis/
│   │   ├── overlay/
│   │   ├── popup/
│   │   ├── storage/
│   │   ├── history/
│   │   ├── alerts/
│   │   ├── watchlists/
│   │   ├── settings/
│   │   ├── notifications/
│   │   └── analytics/
│   ├── adapters/            # Platform-specific adapters
│   │   ├── tradingview/
│   │   ├── binance/
│   │   ├── bybit/
│   │   ├── coinbase/
│   │   ├── kraken/
│   │   ├── zerodha/
│   │   ├── upstox/
│   │   ├── angelone/
│   │   ├── metatrader/
│   │   └── generic/
│   ├── engines/             # Analysis engines
│   │   ├── technical/
│   │   ├── pattern/
│   │   ├── trend/
│   │   ├── support-resistance/
│   │   ├── volume/
        ...
```

## Core Components

### 1. Manifest (manifest.json)
- Defines extension metadata, permissions, and component registration.
- Uses Manifest V3 for improved security and performance.
- Key sections:
  - `action`: Defines the extension toolbar button (opens popup).
  - `background`: Service worker for background processing.
  - `content_scripts`: Scripts injected into matching web pages.
  - `action_default_popup`: HTML file for popup UI.
  - `host_permissions`: Permissions for specific trading domains.
  - `permissions`: Required APIs (storage, scripting, tabs, etc.).
  - `host_permissions`: Access to trading platform domains.
  - `content_security_policy`: Restricts sources for scripts and styles.

### 2. Background Service Worker (background/index.ts)
- Service worker that runs in the background (event-driven).
- Responsibilities:
  - Lifecycle management (install, activate, uninstall).
  - Message passing between components.
  - Alarm management for periodic tasks.
  - Sync coordination with backend services.
  - Handling of extension-wide events.
  - Intercepts and routes messages using a message bus pattern.
- Implementation:
  - Uses Chrome Extension APIs: `chrome.runtime`, `chrome.alarms`, `chrome.storage`.
  - Implements a robust messaging system with request/response patterns.
  - Manages service worker lifecycle to prevent termination during critical operations.

### 3. Content Scripts (content-scripts/index.ts)
- Scripts injected into trading platform web pages.
- Runs in the context of the web page (isolated from extension).
- Responsibilities:
  - Platform detection and version identification.
  - Chart observation and data extraction.
  - Platform-specific DOM manipulation for UI injection.
  - Communication with extension via `window.postMessage` or Chrome messaging.
  - Initialization of platform adapters.
- Implementation:
  - Uses MutationObserver to detect dynamic content changes.
  - Abstracts platform differences through adapter interface.
  - Sandboxed execution to prevent conflicts with page scripts.

### 4. Popup UI (popup/)
- React application that appears when clicking the extension toolbar button.
- Responsibilities:
  - User authentication and session management.
  - Display of current analysis and recommendations.
  - Watchlist management.
  - Settings configuration.
  - Manual analysis triggering.
  - Notification center.
- Implementation:
  - Built with Create React App or Vite for React + TypeScript.
  - State management with React Context or Redux Toolkit.
  - Routing with React Router for different views.
  - API communication with backend services.
  - Local state synchronization with extension storage.

### 5. Overlay UI (overlay/)
- React component injected into trading platform charts.
- Responsibilities:
  - Real-time display of analysis and recommendations.
  - Visual indicators on chart (arrows, labels, zones).
  - Interactive elements for user engagement.
  - Responsive positioning based on chart layout.
  - Theme adaptation (light/dark mode).
- Implementation:
  - Rendered via React Portal into a fixed position container.
  - Uses CSS-in-JS or Tailwind for styling.
  - Subscribes to recommendation updates via messaging.
  - Implements hover tooltips for detailed explanations.
  - Handles user interactions (clicks to expand details).

### 6. Adapter Manager (modules/adapter-manager/)
- Centralized management of platform-specific adapters.
- Responsibilities:
  - Detects active trading platform.
  - Loads and initializes appropriate adapter.
  - Provides unified interface to rest of extension.
  - Handles adapter lifecycle (init, update, destroy).
  - Manages adapter fallback mechanisms.
- Implementation:
  - Factory pattern for adapter instantiation.
  - Registry of available adapters.
  - Interface contract enforcement via TypeScript.
  - Error handling and fallback to generic adapter.

### 7. Platform-Specific Adapters (adapters/)
- Each adapter implements a common interface for platform interaction.
- Interface definition (adapter.ts):
  ```typescript
  interface PlatformAdapter {
    initialize(): Promise<void>;
    destroy(): void;
    getCurrentSymbol(): Promise<string>;
    getCurrentTimeframe(): Promise<string>;
    getChartData(range: TimeRange): Promise<OHLCV[]>;
    getTechnicalIndicators(indicators: IndicatorType[]): Promise<IndicatorData[]>;
    getDrawings(): Promise<Drawing[]>;
    executeTrade(order: TradeOrder): Promise<TradeResult>;
    subscribeToChartUpdates(callback: ChartUpdateCallback): () => void;
    getPlatformInfo(): PlatformInfo;
  }
  ```
- Responsibilities:
  - Abstract platform-specific API differences.
  - Normalize data formats (OHLCV, indicators, drawings).
  - Handle authentication if required (via extension messaging to background).
  - Provide real-time update subscriptions.
  - Execute trades when permitted and configured.

### 8. Website Detection (modules/website-detector/)
- Responsible for identifying the trading platform and version.
- Responsibilities:
  - Analyze page URL, DOM structure, and JavaScript objects.
  - Return platform identifier and version.
  - Detect if platform supports trading features.
  - Cache detection results to avoid redundant checks.
- Implementation:
  - Uses heuristics (URL patterns, specific DOM elements, global objects).
  - Extensible registry of detection rules.
  - Falls back to generic detection for unknown platforms.

### 9. Chart Observer (modules/chart-observer/)
- Monitors chart for changes in symbol, timeframe, and data updates.
- Responsibilities:
  - Detect symbol changes via URL or UI elements.
  - Detect timeframe changes via UI controls.
  - Observe new candlestick data via DOM mutations or API hooks.
  - Debounce rapid changes to prevent excessive processing.
  - Notify interested components of chart state changes.
- Implementation:
  - Combines MutationObserver, event listeners, and polling fallbacks.
  - Implements smart change detection to minimize false positives.
  - Provides observable interface for subscribers.

### 10. Analysis Module (modules/analysis/)
- Coordinates the analysis workflow and orchestrates engines.
- Responsibilities:
  - Receive chart data from adapter manager.
  - Trigger analysis engines based on configuration.
  - Manage engine execution lifecycle (parallel/sequential).
  - Aggregate and normalize engine outputs.
  - Pass results to recommendation orchestrator.
  - Handle engine errors and timeouts.
- Implementation:
  - Pipeline pattern for data flow.
  - Configurable engine execution order.
  - Resource management for concurrent executions.
  - Error boundaries and fallback mechanisms.

### 11. Recommendation Orchestrator (modules/analysis/orchestrator/)
- Implements the recommendation orchestrator pattern.
- Responsibilities:
  - Receive outputs from all analysis engines.
  - Apply weighting and confidence scoring.
  - Resolve conflicting signals between engines.
  - Generate unified trading recommendation.
  - Create human-readable explanations for each recommendation component.
  - Output structured recommendation object.
- Implementation:
  - Rule-based or ML-based fusion strategy.
  - Configurable weights per engine and market condition.
  - Explanation generation using templating or NLG.
  - Uncertainty handling and confidence intervals.

### 12. Analysis Engines (engines/)
- Independent modules implementing specific analysis types.
- Each engine follows a common interface:
  ```typescript
  interface AnalysisEngine {
    analyze(data: ChartData): Promise<AnalysisResult>;
    getMetadata(): EngineMetadata;
    getDependencies(): DataRequirement[];
  }
  ```
- Responsibilities:
  - Perform specialized analysis on chart data.
  - Return structured results with confidence metrics.
  - Declare data requirements (OHLCV, volume, indicators, etc.).
  - Operate independently without direct communication with other engines.
  - Be replaceable without affecting other components.
- Implementation:
  - Pure functions where possible for testability.
  - Caching of intermediate calculations.
  - Configurable parameters per engine.
  - Extensible via plugin architecture.

### 13. Storage Module (modules/storage/)
- Abstracts browser storage mechanisms with encryption for sensitive data.
- Responsibilities:
  - Secure storage of user preferences, API keys, etc.
  - Synchronization with backend services.
  - Conflict resolution for offline changes.
  - Efficient querying and indexing.
  - Data versioning and migration.
- Implementation:
  - Uses `chrome.storage.local` for non-sensitive data.
  - Uses encryption library (e.g., crypto-js) for sensitive data.
  - Implements lazy loading and pagination for large datasets.
  - Provides reactive subscriptions via observables.
  - Handles storage quota management.

### 14. History Module (modules/history/)
- Tracks user interactions and recommendation outcomes.
- Responsibilities:
  - Record recommendation views and interactions.
  - Track user actions (trades, dismissals, saves).
  - Store outcomes for performance analysis.
  - Provide data for analytics and machine learning.
  - Enable replay of past analyses for educational purposes.
- Implementation:
  - Time-series data structure.
  - Efficient querying by time range and symbol.
  - AnonymizationOptions for privacy compliance.
  - Backup and export capabilities.

### 15. Alerts Module (modules/alerts/)
- Manages user-configured price and indicator-based alerts.
- Responsibilities:
  - Store alert definitions with conditions.
  - Monitor market data for trigger conditions.
  - Fire notifications when alerts are triggered.
  - Support complex conditions (AND/OR logic).
  - Allow alert silencing and snoozing.
- Implementation:
  - Rule engine for condition evaluation.
  - Efficient polling or webhook-based checking.
  - Integration with notification system.
  - Persistence and synchronization with backend.

### 16. Watchlists Module (modules/watchlists/)
- Manages user-defined symbol watchlists.
- Responsibilities:
  - Create, update, delete watchlists.
  - Add/remove symbols from watchlists.
  - Track watchlist performance.
  - Synchronize with backend for cross-device availability.
  - Provide quick access to watchlist symbols.
- Implementation:
  - Hierarchical data structure (watchlists contain symbols).
  - Efficient lookup and update operations.
  - Change notifications to interested components.
  - Backup and import/export functionality.

### 17. Settings Module (modules/settings/)
- Manages user preferences and extension configuration.
- Responsibilities:
  - Store user-configurable options.
  - Validate and sanitize input.
  - Provide default values.
  - Notify components of relevant setting changes.
  - Synchronize with backend for roaming profiles.
- Implementation:
  - Schema-based validation (using zod or similar).
  - Categorized settings (general, analysis, alerts, trading, etc.).
  - Export/import of settings profiles.
  - Reset to defaults functionality.

### 18. Notifications Module (modules/notifications/)
- Handles all user notifications within the extension.
- Responsibilities:
  - Display in-extension notifications (toast, modal).
  - Trigger browser notifications when permitted.
  - Manage notification history and preferences.
  - Handle notification actions (clicks, dismissals).
  - Respect user's do-not-disturb settings.
- Implementation:
  - Uses Chrome Notifications API for system notifications.
  - In-app notification center with swipe-to-dismiss.
  - Notification grouping and prioritization.
  - Silent notification options for non-critical alerts.
  - Integration with alert system.

### 19. Analytics Module (modules/analytics/)
- Tracks extension usage and performance metrics.
- Responsibilities:
  - Collect anonymized usage statistics.
  - Monitor performance (load times, render times).
  - Track feature adoption and user behavior.
  - Provide data for A/B testing and feature flags.
  - Export analytics data for external tools.
- Implementation:
  - Lightweight tracking to minimize performance impact.
  - Batch event sending to reduce network overhead.
  - Opt-in/out mechanisms for privacy compliance.
  - Secure transmission of analytics data.
  - Dashboard for internal analytics viewing.

### 20. Shared Modules (shared/)
- Cross-cutting concerns and shared utilities.
- Contents:
  - TypeScript interfaces and types.
  - Utility functions (date formatting, number formatting, etc.).
  - Constants and configuration values.
  - Helper functions for DOM manipulation, storage, messaging.
  - Error classes and error handling utilities.
  - Logging utilities.
  - Animation and transition helpers.
  - Validation schemas.

## Communication Patterns

### 1. Message Passing
- Uses Chrome Runtime messaging for communication between:
  - Content scripts ⇄ Background service worker
  - Popup ⇄ Background service worker
  - Overlay ⇄ Background service worker
- Implements request-response pattern with timeouts.
- Uses message routing based on action types.
- Includes message validation and error handling.

### 2. Custom Events
- Uses CustomEvent for communication within the same context:
  - Content script internal communication.
  - Popup internal React state updates.
  - Overlay internal updates.
- Decouples components within the same boundary.

### 3. Data Flow
- Data flows unidirectionally where possible:
  User Action → Input Processing → State Update → Render
- Uses observable patterns for reactive updates (RxJS or custom observables).
- Implements dirty checking for performance-critical updates.

### 4. Storage Synchronization
- Local-first approach with background synchronization:
  1. Changes written to local storage immediately.
  2. Background worker detects changes via storage change listeners.
  3. Changes queued for backend synchronization.
  4. Network resilience with exponential backoff retry.
  5. Conflict resolution using last-write-wins or vector clocks.

## Security Considerations

### 1. Content Security Policy (CSP)
- Strict CSP in manifest to prevent XSS:
  ```
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self';"
  }
  ```
- Inline scripts and styles are prohibited.
- All external resources must be explicitly allowed.

### 2. Data Protection
- Sensitive data (API keys, credentials) encrypted at rest.
- Encryption key derived from user session or hardware-backed storage.
- Regular key rotation mechanisms.
- Secure deletion of sensitive data when no longer needed.

### 3. Permission Minimalism
- Requests only necessary permissions in manifest.
- Uses host permissions for specific trading domains only.
- Implements incremental authorization for sensitive operations.
- Regular permission usage audits.

### 4. Communication Security
- All messages validated and sanitized.
- Prevents message spoofing between extension components.
- Uses message signing for critical operations if needed.
- Implements rate limiting on message processing to prevent flooding.

### 5. External Communication
- HTTPS enforced for all backend communications.
- Certificate pinning for critical API endpoints.
- OAuth 2.0 PKCE for secure authentication flows.
- Short-lived access tokens with refresh token rotation.
- Secrets never stored in extension code or visible in devtools.

## Performance Optimization

### 1. Lazy Loading
- Code splitting for popup, overlay, and background scripts.
- Dynamic imports for non-critical features.
- Prefetching of likely-to-be-needed resources.
- Sized chunks for optimal loading.

### 2. Efficient DOM Observation
- MutationObserver optimizations (subtree vs childList filtering).
- RequestAnimationFrame for visual updates.
- Debouncing and throttling of frequent updates.
- Virtual scrolling for large lists (watchlists, history).

### 3. Memory Management
- Object pooling for frequent allocations.
- Weak references for observers and listeners.
- Regular cleanup of event listeners and intervals.
- Memory leak detection in development.
- Efficient data structures for large datasets (Maps, Sets).

### 4. Rendering Optimization
- React.memo and useMemo for expensive computations.
- Virtualized lists for large data sets.
- CSS containment for layout isolation.
- GPU-accelerated animations where possible.
- Minimization of layout thrashing.

### 5. Network Efficiency
- Request batching and deduplication.
- Conditional requests with ETags/Last-Modified.
- Response caching with Cache-Control headers.
- Compression (gzip/brotli) for API responses.
- Prioritization of critical requests.

## Extensibility and Plugin System

### 1. Architecture for Extensions
- Core extension designed to be extensible without modification.
- Plugin interface for adding new analysis engines.
- Plugin interface for adding new data sources (market data, news).
- Plugin interface for adding new broker integrations.
- Plugin interface for adding new notification channels.

### 2. Plugin Contracts
- Well-defined TypeScript interfaces for each plugin type.
- Versioned interfaces to ensure backward compatibility.
- Discovery mechanism for plugins (manifest-based or registry-based).
- Sandboxed execution environment for plugins.
- Resource quotas for plugin execution.

### 3. Plugin Management
- Plugin marketplace or local installation.
- Enable/disable plugins without restart.
- Automatic updates for approved plugins.
- Permission system for plugin capabilities.
- Isolation between plugins to prevent interference.

## Development and Deployment

### 1. Development Environment
- Monorepo structure with shared packages.
- TypeScript strict mode for type safety.
- ESLint and Prettier for code quality.
- Jest and React Testing Library for unit testing.
- Cypress or Playwright for end-to-end testing.
- Storybook for UI component development.
- Docker-compose for local development stack.

### 2. Build Process
- Webpack/Vite for bundling and optimization.
- Separate builds for different extension contexts:
  - Background service worker (ESM)
  - Content scripts (UMD or IIFE)
  - Popup (React bundle)
  - Overlay (React bundle)
- Tree shaking and dead code elimination.
- Asset optimization (images, fonts).
- Source maps for debugging (disabled in production).

### 3. Testing Strategy
- Unit tests: 80%+ coverage for business logic.
- Integration tests: Component interactions and API contracts.
- End-to-end tests: Critical user flows across extension boundaries.
- Visual regression tests: UI consistency across versions.
- Performance tests: Load times and memory usage.
- Security scans: Dependency scanning and SAST/DAST.

### 4. Release Process
- Automated versioning based on conventional commits.
- Changelog generation from commit history.
- Automated publishing to Chrome Web Store and Firefox AMO.
- Staged rollout capabilities.
- Rollback mechanisms for problematic releases.
- User feedback collection and analysis.

## Accessibility (a11y)

### 1. WCAG 2.1 Compliance
- Keyboard navigation for all interactive elements.
- ARIA labels and roles for screen readers.
- Sufficient color contrast (minimum 4.5:1).
- Resizable text without loss of functionality.
- Focus management for modal dialogs.
- Skip navigation links where appropriate.

### 2. Implementation
- Semantic HTML elements where possible.
- Accessible React components (using Reach UI or similar).
- Custom hooks for accessibility concerns.
- Regular axe-core accessibility testing.
- User testing with assistive technologies.

## Internationalization (i18n)

### 1. Supported Locales
- Initial launch: English (en-US).
- Framework for easy addition of new locales.
- Externalized strings in JSON format.
- Date, number, and currency formatting per locale.
- Right-to-left (RTL) layout support where needed.

### 2. Implementation
- i18next or react-i18next for translation management.
- Lazy loading of locale resources.
- Fallback to default language for missing translations.
- Date formatting via Intl API.
- Number and currency formatting via Intl API.
- Context-aware translation for pluralization and gender.

## Error Handling and Monitoring

### 1. Frontend Error Handling
- Global error boundaries in React apps.
- try/catch for asynchronous operations.
- User-friendly error messages without exposing internals.
- Error reporting to backend for analysis.
- Graceful degradation when features fail.

### 2. Backend Error Handling
- Centralized error handling middleware.
- Structured error logging with correlation IDs.
- Distributed tracing for cross-service requests.
- Circuit breaker pattern for external dependencies.
- Health checks and graceful degradation.

### 3. Monitoring and Observability
- Structured logging with request IDs.
- Key metrics: latency, error rates, throughput.
- Real-user monitoring (RUM) for performance.
- Custom business metrics (active users, recommendation accuracy).
- Alerting on anomalies and SLA violations.
- Regular health check endpoints.

## Compliance and Legal

### 1. Financial Regulations
- Clear disclaimer that the tool provides analysis, not financial advice.
- No guarantee of performance or accuracy.
- Encourages users to consult financial professionals.
- Compliance with local financial advisory regulations where applicable.
- Age restrictions and disclaimers for leveraged products.

### 2. Data Protection
- GDPR/CCPA compliance for user data.
- Right to access, rectify, and delete personal data.
- Data minimization principles.
- Explicit consent for data collection and processing.
- Data processing agreements with third-party services.
- Regular data protection impact assessments.

### 3. Intellectual Property
- Respect for trading platforms' terms of service.
- No reverse engineering or violation of platform policies.
- Attribution for third-party data sources and APIs.
- Proper licensing for open-source dependencies.
- Trademark compliance for platform names and logos.

## Future Enhancements

### 1. Advanced Features
- Social trading and community insights.
- Advanced order types and algorithmic trading.
- Portfolio optimization and rebalancing suggestions.
- Tax-loss harvesting assistance.
- Integration with financial planning tools.

### 2. Technical Improvements
- WebAssembly for performance-critical calculations.
- Offline-first capabilities with service workers.
- Progressive Web App (PWA) mode for supported platforms.
- Voice command integration.
- Augmented reality overlays for spatial computing devices.

### 3. Expansion Plans
- Additional trading platforms (stock exchanges, futures, options).
- Integration with more data providers (fundamental data, economic indicators).
- Expanded broker support (retail banks, wealth platforms).
- Localization for additional languages and regions.
- Industry-specific versions (crypto, forex, commodities).

---
*Document Version: 1.0*
*Last Updated: 2026-07-25*