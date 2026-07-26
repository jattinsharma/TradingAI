// Popup Utilities
export function initializePopup() {
    // Get DOM elements
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    const analyzeBtn = document.getElementById('analyze-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const watchlistBtn = document.getElementById('watchlist-btn');
    const analysisContent = document.getElementById('analysis-content');
    const recommendationContent = document.getElementById('recommendation-content');

    // Set initial status
    updateStatus('Disconnected', 'offline');

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'STATUS_UPDATE') {
            updateStatus(message.status, message.connected ? 'online' : 'offline');
        } else if (message.type === 'ANALYSIS_UPDATE') {
            displayAnalysis(message.data);
        } else if (message.type === 'RECOMMENDATION_UPDATE') {
            displayRecommendation(message.data);
        }
    });

    // Event listeners
    analyzeBtn.addEventListener('click', () => {
        // Request analysis from content script
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {type: 'REQUEST_ANALYSIS'});
            }
        });
    });

    settingsBtn.addEventListener('click', () => {
        // Open options page
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            window.open(chrome.runtime.getURL('options.html'));
        }
    });

    watchlistBtn.addEventListener('click', () => {
        // TODO: Implement watchlist view
        alert('Watchlist feature coming soon!');
    });

    // Helper functions
    function updateStatus(text, state) {
        statusText.textContent = text;
        statusIndicator.className = `status-indicator ${state}`;
    }

    function displayAnalysis(data) {
        if (!data || Object.keys(data).length === 0) {
            analysisContent.innerHTML = '<div class="placeholder"><p>No analysis data available.</p></div>';
            return;
        }

        // Format and display analysis data
        analysisContent.innerHTML = `
            <div class="analysis-grid">
                <div class="analysis-item">
                    <h3>Trend</h3>
                    <p>${data.trend?.direction || 'N/A'} (${Math.round((data.trend?.strength || 0) * 100)}%)</p>
                </div>
                <div class="analysis-item">
                    <h3>Momentum</h3>
                    <p>${data.momentum?.signal || 'N/A'} (${Math.round((data.momentum?.strength || 0) * 100)}%)</p>
                </div>
                <div class="analysis-item">
                    <h3>Volume</h3>
                    <p>${data.volume?.signal || 'N/A'} (${Math.round((data.volume?.strength || 0) * 100)}%)</p>
                </div>
                <div class="analysis-item">
                    <h3>Volatility</h3>
                    <p>${data.volatility?.signal || 'N/A'} (${Math.round((data.volatility?.strength || 0) * 100)}%)</p>
                </div>
            </div>
        `;
    }

    function displayRecommendation(data) {
        if (!data) {
            recommendationContent.innerHTML = '<div class="placeholder"><p>No recommendation available.</p></div>';
            return;
        }

        const recommendation = data.recommendation || 'HOLD';
        const confidence = Math.round((data.confidence || 0) * 100);

        // Determine colors based on recommendation
        let bgColor = '#fff3cd'; // default yellow for HOLD
        let textColor = '#856404';

        if (recommendation === 'BUY' || recommendation === 'STRONG_BUY') {
            bgColor = '#d4edda';
            textColor = '#155724';
        } else if (recommendation === 'SELL' || recommendation === 'STRONG_SELL') {
            bgColor = '#f8d7da';
            textColor = '#721c24';
        }

        recommendationContent.innerHTML = `
            <div class="recommendation-card" style="background-color: ${bgColor}; color: ${textColor};">
                <h2>${recommendation}</h2>
                <p>Confidence: ${confidence}%</p>
                <div class="reasoning">
                    <h3>Reasoning:</h3>
                    <p>${data.reasoning || 'No detailed reasoning available.'}</p>
                </div>
            </div>
        `;
    }
}