# Component Diagram

```mermaid
graph TD
    %% Frontend Components
    subgraph Browser Extension [Browser Extension]
        direction TB
        Popup[Popup UI]
        Overlay[Overlay UI]
        Background[Background Service Worker]
        ContentScripts[Content Scripts]
        AdapterManager[Adapter Manager]
        WebsiteDetection[Website Detection]
        ChartObserver[Chart Observer]
        Analysis[Analysis Module]
        Alerts[Alerts Module]
        Watchlists[Watchlists Module]
        Settings[Settings Module]
        Notifications[Notifications Module]
        Storage[Storage Module]
        History[History Module]
        Analytics[Analytics Module]
    end

    %% Platform Adapters
    subgraph Platform Adapters [Platform Adapters]
        direction TB
        TradingView[TradingView Adapter]
        Binance[Binance Adapter]
        Bybit[Bybit Adapter]
        Coinbase[Coinbase Adapter]
        Kraken[Kraken Adapter]
        Zerodha[Zerodha Adapter]
        Upstox[Upstox Adapter]
        AngelOne[AngelOne Adapter]
        MetaTrader[MetaTrader Adapter]
        Generic[Generic Adapter]
    end

    %% Analysis Engines
    subgraph Analysis Engines [Analysis Engines]
        direction TB
        Technical[Technical Engine]
        Pattern[Pattern Engine]
        Trend[Trend Engine]
        SRSupport[Support & Resistance Engine]
        Volume[Volume Engine]
        Momentum[Momentum Engine]
        News[News Engine]
        Sentiment[Sentiment Engine]
        Risk[Risk Engine]
        Portfolio[Portfolio Engine]
        TradePlanner[Trade Planner]
        AIExplain[AI Explanation Engine]
    end

    %% Recommendation Orchestrator
    Orchestrator[Recommendation Orchestrator]

    %% Backend Services
    subgraph Backend [Backend Services]
        direction TB
        API[REST API Gateway]
        Auth[Auth Service]
        User[User Service]
        MarketData[Market Data Service]
        NewsService[News Service]
        Broker[Broker Service]
        Recommendation[Recommendation Service]
        AlertService[Alert Service]
        AnalyticsService[Analytics Service]
        DB[(PostgreSQL Database)]
        Cache[(Redis Cache)]
    end

    %% External Integrations
    subgraph External [External Integrations]
        direction TB
        MarketProviders[Market Data Providers]
        NewsProviders[News Providers]
        BrokerAPIs[Broker APIs]
        AIProviders[AI Providers (Vercel AI Gateway)]
    end

    %% Relationships
    %% Extension internal connections
    Popup -->|User Input| Background
    Background -->|UI Updates| Popup
    Overlay <---> Background
    ContentScripts -->|Platform Events| WebsiteDetection
    ContentScripts -->|Chart Data| ChartObserver
    WebsiteDetection -->|Platform Info| AdapterManager
    ChartObserver -->|Symbol/Timeframe Updates| Analysis
    AdapterManager -->|Platform Data| Analysis
    AdapterManager -->|Trade Execution Requests| Background
    Analysis -->|Engine Requests| Orchestrator
    Orchestrator -->|Analysis Results| Analysis
    Orchestrator -->|Unified Recommendation| Background
    Background -->|Display Recommendation| Overlay
    Background -->|Display Recommendation| Popup
    Background -->|Store Data| Storage
    Background -->|Sync with Backend| API
    Alerts -->|User Alerts| Background
    Watchlists -->|Watchlist Data| Background
    Settings -->|User Preferences| Background
    Notifications -->|System Alerts| Background
    Storage -->|Local Persistence| Background
    History -->|User Actions| Background
    Analytics -->|Usage Data| Background

    %% Adapter connections to platforms
    TradingView -->|Platform Specific API| TradingViewPlatform[TradingView Website]
    Binance -->|Platform Specific API| BinancePlatform[Binance Website]
    Bybit -->|Platform Specific API| BybitPlatform[Bybit Website]
    Coinbase -->|Platform Specific API| CoinbasePlatform[Coinbase Website]
    Kraken -->|Platform Specific API| KrakenPlatform[Kraken Website]
    Zerodha -->|Platform Specific API| ZerodhaPlatform[Zerodha Website]
    Upstox -->|Platform Specific API| UpstoxPlatform[Upstox Website]
    AngelOne -->|Platform Specific API| AngelOnePlatform[AngelOne Website]
    MetaTrader -->|Platform Specific API| MetaTraderPlatform[MetaTrader Website]
    Generic -->|Standard API| VariousPlatforms[Various Trading Platforms]

    %% Backend connections
    API --> Auth
    API --> User
    API --> MarketData
    API --> NewsService
    API --> Broker
    API --> Recommendation
    API --> AlertService
    API --> AnalyticsService
    Auth --> DB
    User --> DB
    MarketData --> DB
    MarketData --> Cache
    NewsService --> DB
    Broker --> DB
    Recommendation --> DB
    Recommendation --> Cache
    AlertService --> DB
    AnalyticsService --> DB
    AnalyticsService --> Cache

    %% Backend to external integrations
    MarketData -->|Data Requests| MarketProviders
    NewsService -->|Data Requests| NewsProviders
    Broker -->|Authenticated Requests| BrokerAPIs
    Recommendation -->|AI Analysis Requests| AIProviders

    %% Styling
    classDef extension fill:#E3F2FD,stroke:#1565C0,stroke-width:2px;
    classDef adapters fill:#FFF3E0,stroke:#EF6C00,stroke-width:2px;
    classDef analysis fill:#E8F5E8,stroke:#2E7D32,stroke-width:2px;
    classDef orchestrator fill:#F3E5F5,stroke:#6A1B9A,stroke-width:2px;
    classDef backend fill:#FFEBEE,stroke:#C62828,stroke-width:2px;
    classDef external fill:#F5F5F5,stroke:#616161,stroke-width:2px;
    classDef database fill:#E8EAF6,stroke:#3F51B5,stroke-width:2px;

    class Popup,Overlay,Background,ContentScripts,AdapterManager,WebsiteDetection,ChartObserver,Analysis,Alerts,Watchlists,Settings,Notifications,Storage,History,Analytics extension;
    class TradingView,Binance,Bybit,Coinbase,Kraken,Zerodha,Upstox,AngelOne,MetaTrader,Generic adapters;
    class Technical,Pattern,Trend,SRSupport,Volume,Momentum,News,Sentiment,Risk,Portfolio,TradePlanner,AIExplain analysis;
    class Orchestrator orchestrator;
    class API,Auth,User,MarketData,NewsService,Broker,Recommendation,AlertService,AnalyticsService backend;
    class MarketProviders,NewsProviders,BrokerAPIs,AIProviders external;
    class DB,Cache database;
```
```