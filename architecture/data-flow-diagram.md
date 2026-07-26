# Data Flow Diagram

```mermaid
flowchart TD
    %% External Entities
    User[User]:::external
    TradingPlatform[Trading Platform]:::external
    MarketDataProviders[Market Data Providers]:::external
    NewsProviders[News Providers]:::external
    BrokerAPIs[Broker APIs]:::external
    AIProviders[AI Providers]:::external

    %% Processes
    subgraph Extension[Browser Extension]
        direction TB
        WS[Website Detection]:::process
        CO[Chart Observer]:::process
        AM[Adapter Manager]:::process
        PA[Platform Adapter]:::process
        AN[Analysis Module]:::process
        OR[Orchestrator]:::process
        TE[Technical Engine]:::process
        PE[Pattern Engine]:::process
        TRE[Trend Engine]:::process
        SRE[Support & Resistance Engine]:::process
        VE[Volume Engine]:::process
        ME[Momentum Engine]:::process
        NE[News Engine]:::process
        SE[Sentiment Engine]:::process
        OV[Overlay UI]:::process
        PU[Popup UI]:::process
        BG[Background Service Worker]:::process
        ST[Storage Module]:::process
        AL[Alerts Module]:::process
        WL[Watchlists Module]:::process
        SE[Settings Module]:::process
        NO[Notifications Module]:::process
        HM[History Module]:::process
        ANLY[Analytics Module]:::process
    end

    subgraph Backend[Backend Services]
        direction TB
        API[API Gateway]:::process
        AUTH[Auth Service]:::process
        USR[User Service]:::process
        MDS[Market Data Service]:::process
        NWS[News Service]:::process
        BKS[Broker Service]:::process
        RCS[Recommendation Service]:::process
        ALS[Alert Service]:::process
        ANLS[Analytics Service]:::process
    end

    %% Data Stores
    DS_Local[(Extension Local Storage)]:::datastore
    DS_History[(Recommendation History)]:::datastore
    DS_Watchlist[(Watchlist Data)]:::datastore
    DS_Settings[(User Settings)]:::datastore
    DS_Cache[(Redis Cache)]:::datastore
    DS_User[(User Profiles)]:::datastore
    DS_Market[(Market Data)]:::datastore
    DS_News[(News Data)]:::datastore
    DS_Broker[(Broker Connections)]:::datastore
    DS_Rec[(Recommendations)]:::datastore
    DS_Alert[(Alerts)]:::datastore
    DS_Feedback[(Feedback)]:::datastore
    DS_Portfolio[(Portfolio)]:::datastore
    DS_TradeJournal[(Trade Journal)]:::datastore
    DS_Audit[(Audit Logs)]:::datastore
    DS_AIMemory[(Future AI Memory)]:::datastore

    %% Data Flows
    %% User to Extension
    User -->|Interacts with Trading Platform| TradingPlatform
    TradingPlatform -->|Page Content| Extension

    %% Website Detection
    TradingPlatform -->|DOM Content| WS
    WS -->|Platform Identity| CO
    WS -->|Platform Identity| AM

    %% Chart Observation
    CO -->|Chart Events (symbol/timeframe/new data)| AM
    CO -->|Chart Events| AN

    %% Adapter Management
    AM -->|Platform-Specific Requests| PA
    PA -->|Platform API Calls| TradingPlatform
    TradingPlatform -->|Chart Data (OHLCV, etc.)| PA
    PA -->|Normalized Chart Data| AM
    AM -->|Chart Data| AN

    %% Analysis Module
    AN -->|Analysis Request| OR
    OR -->|Engine Requests| TE
    OR -->|Engine Requests| PE
    OR -->|Engine Requests| TRE
    OR -->|Engine Requests| SRE
    OR -->|Engine Requests| VE
    OR -->|Engine Requests| ME
    OR -->|Engine Requests| NE
    OR -->|Engine Requests| SE
    TE -->|Technical Indicators| OR
    PE -->|Pattern Detection| OR
    TRE -->|Trend Analysis| OR
    SRE -->|Support/Resistance Levels| OR
    VE -->|Volume Analysis| OR
    ME -->|Momentum Metrics| OR
    NE -->|News Summary| OR
    SE -->|Sentiment Score| OR
    OR -->|Synthesized Recommendation| AN
    AN -->|Recommendation + Explanation| BG

    %% Background Service Worker
    BG -->|Display Request| OV
    BG -->|Display Request| PU
    BG -->|Store Request| ST
    BG -->|Sync Request| API

    %% Storage Module
    ST -->|Read/Write| DS_Local
    ST -->|History Update| DS_History
    ST -->|Watchlist Update| DS_Watchlist
    ST -->|Settings Update| DS_Settings
    ST -->|Analytics Update| DS_Analy

    %% Alerts Module
    AL -->|Alert Configuration| BG
    AL -->|Alert Trigger| NO

    %% Watchlists Module
    WL -->|Watchlist Management| BG

    %% Settings Module
    SE -->|Preference Management| BG

    %% Notifications Module
    NO -->|User Notifications| BG

    %% History Module
    HM -->|Action Logging| BG

    %% Analytics Module
    ANLY -->|Usage Tracking| BG

    %% Backend API Gateway
    API -->|Request Routing| AUTH
    API -->|Request Routing| USR
    API -->|Request Routing| MDS
    API -->|Request Routing| NWS
    API -->|Request Routing| BKS
    API -->|Request Routing| RCS
    API -->|Request Routing| ALS
    API -->|Request Routing| ANLS

    %% Backend Services to Data Stores
    AUTH -->|User Auth Data| DS_User
    AUTH -->|Session Data| DS_Cache
    USR -->|Profile Data| DS_User
    USR -->|Settings Data| DS_Settings
    MDS -->|Market Data Requests| MarketDataProviders
    MarketDataProviders -->|Market Data| MDS
    MDS -->|Cached Market Data| DS_Cache
    MDS -->|Persistent Market Data| DS_Market
    NWS -->|News Requests| NewsProviders
    NewsProviders -->|News Data| NWS
    NWS -->|Cached News| DS_Cache
    NWS -->|Persistent News| DS_News
    BKS -->|Broker API Requests| BrokerAPIs
    BrokerAPIs -->|Account Data| BKS
    BKS -->|Encrypted Credentials| DS_Broker
    RCS -->|Recommendation Requests| OR (via extension)
    RCS -->|Stored Recommendations| DS_Rec
    ALS -->|Alert Definitions| DS_Alert
    ALS -->|Triggered Alerts| DS_Alert
    ANLS -->|Aggregated Analytics| DS_Analy
    ANLS -->|Usage Metrics| DS_Cache

    %% Cross-cutting: Audit Logging
    AUTH -->|Audit Events| DS_Audit
    USR -->|Audit Events| DS_Audit
    MDS -->|Audit Events| DS_Audit
    NWS -->|Audit Events| DS_Audit
    BKS -->|Audit Events| DS_Audit
    RCS -->|Audit Events| DS_Audit
    ALS -->|Audit Events| DS_Audit
    ANLS -->|Audit Events| DS_Audit

    %% Extension to Backend Sync
    BG -->|Encrypted Sync Payload| API
    API -->|Process Sync Data| USR
    API -->|Process Sync Data| MDS
    API -->|Process Sync Data| RCS
    API -->|Process Sync Data| WL
    API -->|Process Sync Data| SE
    API -->|Store to Respective DS| DS_User
    API -->|Store to Respective DS| DS_Market
    API -->|Store to Respective DS| DS_Rec
    API -->|Store to Respective DS| DS_Watchlist
    API -->|Store to Respective DS| DS_Settings
    API -->|Sync Acknowledgment| BG

    %% Styling
    classDef external fill:#F5F5F5,stroke:#9E9E9E,stroke-width:1px;
    classDef process fill:#E3F2FD,stroke:#1565C0,stroke-width:2px;
    classDef datastore fill:#FFF8E1,stroke:#FFB300,stroke-width:2px;
```
```