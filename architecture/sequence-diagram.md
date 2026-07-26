# Sequence Diagram: Chart Analysis and Recommendation Display

```mermaid
sequenceDiagram
    participant User
    participant TradingPlatform as Trading Platform Website
    participant ContentScripts as Content Scripts
    participant WebsiteDetection as Website Detection
    participant ChartObserver as Chart Observer
    participant AdapterManager as Adapter Manager
    participant PlatformAdapter as Platform Adapter
    participant AnalysisModule as Analysis Module
    participant Orchestrator as Recommendation Orchestrator
    participant TechnicalEngine as Technical Engine
    participant PatternEngine as Pattern Engine
    participant TrendEngine as Trend Engine
    participant SREngine as Support & Resistance Engine
    participant VolumeEngine as Volume Engine
    participant MomentumEngine as Momentum Engine
    participant NewsEngine as News Engine
    participant SentimentEngine as Sentiment Engine
    participant Overlay as Overlay UI
    participant Background as Background Service Worker
    participant Popup as Popup UI
    participant Storage as Storage Module

    %% User visits trading platform
    User->>TradingPlatform: Loads trading platform (e.g., TradingView)
    TradingPlatform-->>User: Displays trading interface

    %% Content scripts injected
    ContentScripts->>TradingPlatform: Inject extension scripts
    Note over ContentScripts: Runs in context of trading platform

    %% Website detection
    ContentScripts->>WebsiteDetection: Detect platform and version
    WebsiteDetection-->>ContentScripts: Return platform info (e.g., TradingView v1)

    %% Chart observer setup
    ContentScripts->>ChartObserver: Initialize chart observation
    ChartObserver->>TradingPlatform: Monitor chart for symbol/timeframe changes

    %% Chart update event (e.g., symbol change or new candle)
    alt Chart Update Event
        TradingPlatform->>ChartObserver: Chart updated (new data)
        ChartObserver->>ContentScripts: Chart update event
        ContentScripts->>AdapterManager: Request chart data for current symbol/timeframe
        AdapterManager->>PlatformAdapter: Get chart data (OHLCV, indicators, etc.)
        PlatformAdapter-->>AdapterManager: Return chart data
        AdapterManager-->>ContentScripts: Chart data payload
        ContentScripts->>AnalysisModule: Pass chart data for analysis
        AnalysisModule->>Orchestrator: Request analysis
        Orchestrator->>TechnicalEngine: Analyze technical indicators
        Orchestrator->>PatternEngine: Detect chart patterns
        Orchestrator->>TrendEngine: Determine market trend
        Orchestrator->>SREngine: Calculate support/resistance levels
        Orchestrator->>VolumeEngine: Analyze volume data
        Orchestrator->>MomentumEngine: Measure momentum
        Orchestrator->>NewsEngine: Fetch relevant news
        Orchestrator->>SentimentEngine: Analyze market sentiment
        note right of Orchestrator: Engines operate independently
        TechnicalEngine-->>Orchestrator: Return technical analysis
        PatternEngine-->>Orchestrator: Return pattern detection
        TrendEngine-->>Orchestrator: Return trend analysis
        SREngine-->>Orchestrator: Return support/resistance
        VolumeEngine-->>Orchestrator: Return volume analysis
        MomentumEngine-->>Orchestrator: Return momentum analysis
        NewsEngine-->>Orchestrator: Return news summary
        SentimentEngine-->>Orchestrator: Return sentiment score
        Orchestrator->>Orchestrator: Synthesize recommendation
        Orchestrator->>Orchestrator: Generate explanation
        Orchestrator-->>AnalysisModule: Return unified recommendation + explanation
        AnalysisModule-->>ContentScripts: Pass recommendation to display
        ContentScripts->>Background: Send recommendation via extension messaging
        Background->>Overlay: Update overlay with recommendation
        Overlay-->>User: Display analysis and explanation on chart
        Background->>Popup: Update popup with recommendation details
        Popup-->>User: Show detailed analysis in popup
        Background->>Storage: Store recommendation in local history
        Background->>Storage: Update analytics
    end

    %% User interaction: Save to watchlist
    alt User saves to watchlist
        User->>Popup: Click "Add to Watchlist"
        Popup->>Background: Send watchlist update request
        Background->>Storage: Update local watchlist
        Background->>Storage: Sync flag set
    end

    %% Periodic sync with backend (every 5 minutes or on significant event)
    every 5 minutes
        Background->>Storage: Check for sync needed
        alt Sync needed
            Background->>Background: Prepare sync payload
            Background->>Backend API: POST /api/v1/sync
            Backend API-->>Background: Sync acknowledgment
            Background->>Storage: Clear sync flag
        end
    end
```
```