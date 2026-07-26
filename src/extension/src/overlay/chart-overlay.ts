/**
 * Enhanced Chart Overlay Component
 * Premium dark-mode overlay with full trade setup display.
 */

export class ChartOverlay {
  private overlayContainer: HTMLElement | null = null;
  private isInitialized = false;
  private isVisible = true;
  private isPinned = false;
  private isDragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private lastDragTime = 0;
  private readonly DRAG_THROTTLE_MS = 16;

  constructor() {
    // Arrow functions don't need binding
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const container = document.createElement('div');
      container.id = 'trading-copilot-overlay';
      container.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 12px; color: #e6edf3;
      `;

      container.innerHTML = `
        <div id="overlay-container" style="
          width: 320px; background: rgba(13,17,23,0.94);
          border: 1px solid rgba(48,54,61,0.8); border-radius: 10px;
          overflow: hidden; backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        ">
          <div class="overlay-header" style="
            display:flex;align-items:center;justify-content:space-between;
            padding:10px 14px;background:rgba(22,27,34,0.9);border-bottom:1px solid rgba(48,54,61,0.8);
            cursor:move;user-select:none;
          ">
            <div style="display:flex;align-items:center;gap:8px;">
              <span id="ov-symbol" style="font-size:15px;font-weight:700;">---</span>
              <span id="ov-timeframe" style="font-size:10px;color:#6e7681;background:rgba(33,38,45,0.85);padding:2px 6px;border-radius:4px;">---</span>
            </div>
            <div style="display:flex;gap:4px;">
              <button id="ov-settings-btn" style="background:none;border:none;color:#6e7681;font-size:14px;cursor:pointer;padding:2px 6px;border-radius:4px;" title="Settings">⚙️</button>
              <button id="ov-close-btn" style="background:none;border:none;color:#6e7681;font-size:14px;cursor:pointer;padding:2px 6px;border-radius:4px;" title="Close">✕</button>
            </div>
          </div>
          <div style="padding:12px 14px;">
            <div id="ov-rec-box" style="text-align:center;padding:10px;margin-bottom:10px;border-radius:8px;background:rgba(33,38,45,0.85);">
              <div id="ov-rec-text" style="font-size:18px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">ANALYZING</div>
              <div id="ov-rec-sub" style="font-size:11px;opacity:0.85;margin-top:2px;">Computing signals...</div>
              <div style="width:100%;height:3px;background:rgba(255,255,255,0.15);border-radius:2px;overflow:hidden;margin:6px 0;">
                <div id="ov-conf-fill" style="height:100%;border-radius:2px;transition:width 0.6s ease;width:0%;background:#fff;"></div>
              </div>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(48,54,61,0.8);margin-bottom:8px;">
              <span style="font-size:11px;color:#8b949e;">Current Price</span>
              <span id="ov-price" style="font-size:14px;font-weight:600;color:#e6edf3;">---</span>
            </div>
            <div id="ov-setup-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:8px;">
              <div class="setup-item" style="display:flex;justify-content:space-between;padding:5px 8px;background:rgba(33,38,45,0.85);border-radius:4px;font-size:11px;">
                <span style="color:#6e7681;">Entry</span>
                <span id="ov-entry" style="font-weight:600;color:#3fb950;">---</span>
              </div>
              <div class="setup-item" style="display:flex;justify-content:space-between;padding:5px 8px;background:rgba(33,38,45,0.85);border-radius:4px;font-size:11px;">
                <span style="color:#6e7681;">Stop Loss</span>
                <span id="ov-sl" style="font-weight:600;color:#f85149;">---</span>
              </div>
              <div class="setup-item" style="display:flex;justify-content:space-between;padding:5px 8px;background:rgba(33,38,45,0.85);border-radius:4px;font-size:11px;">
                <span style="color:#6e7681;">Take Profit</span>
                <span id="ov-tp" style="font-weight:600;color:#3fb950;">---</span>
              </div>
              <div class="setup-item" style="display:flex;justify-content:space-between;padding:5px 8px;background:rgba(33,38,45,0.85);border-radius:4px;font-size:11px;">
                <span style="color:#6e7681;">R:R Ratio</span>
                <span id="ov-rr" style="font-weight:600;color:#d29922;">---</span>
              </div>
              <div class="setup-item" style="display:flex;justify-content:space-between;padding:5px 8px;background:rgba(33,38,45,0.85);border-radius:4px;font-size:11px;">
                <span style="color:#6e7681;">Risk</span>
                <span id="ov-risk" style="font-weight:600;color:#e6edf3;">---</span>
              </div>
              <div class="setup-item" style="display:flex;justify-content:space-between;padding:5px 8px;background:rgba(33,38,45,0.85);border-radius:4px;font-size:11px;">
                <span style="color:#6e7681;">Duration</span>
                <span id="ov-duration" style="font-weight:600;color:#e6edf3;">---</span>
              </div>
            </div>
            <div style="font-size:10px;font-weight:600;color:#6e7681;text-transform:uppercase;letter-spacing:0.5px;margin:8px 0 4px;">Reasoning</div>
            <div id="ov-reasoning" style="font-size:11px;color:#8b949e;line-height:1.5;padding:6px 8px;background:rgba(33,38,45,0.85);border-radius:4px;max-height:60px;overflow:hidden;cursor:pointer;transition:max-height 0.3s;margin-bottom:8px;">No analysis yet.</div>
            <div id="ov-risks-section" style="display:none;">
              <div style="font-size:10px;font-weight:600;color:#6e7681;text-transform:uppercase;letter-spacing:0.5px;margin:8px 0 4px;">Key Risks</div>
              <div id="ov-risks-list"></div>
            </div>
          </div>
          <div style="display:flex;align-items:center;justify-content:flex-end;gap:4px;padding:6px 14px;background:rgba(22,27,34,0.9);border-top:1px solid rgba(48,54,61,0.8);">
            <button id="ov-reanalyze-btn" style="background:none;border:none;color:#6e7681;font-size:12px;cursor:pointer;padding:2px 8px;border-radius:4px;" title="Re-analyze">🔄 Re-analyze</button>
            <button id="ov-pin-btn" style="background:none;border:none;color:#6e7681;font-size:12px;cursor:pointer;padding:2px 8px;border-radius:4px;" title="Pin">📌 Pin</button>
          </div>
        </div>
      `;

      document.body.appendChild(container);
      this.overlayContainer = container;

      // Wire up buttons (use setTimeout to ensure DOM is rendered)
      setTimeout(() => {
        const closeBtn = container.querySelector('#ov-close-btn');
        if (closeBtn) {
          closeBtn.addEventListener('click', () => { this.hide(); });
        }

        const reanalyzeBtn = container.querySelector('#ov-reanalyze-btn');
        if (reanalyzeBtn) {
          reanalyzeBtn.addEventListener('click', () => {
            chrome.runtime.sendMessage({ type: 'REQUEST_ANALYSIS', payload: { force: true } });
            this.showLoading('Re-analyzing...');
          });
        }

        const pinBtn = container.querySelector('#ov-pin-btn');
        if (pinBtn) {
          pinBtn.addEventListener('click', () => {
            this.isPinned = !this.isPinned;
            pinBtn.textContent = this.isPinned ? '📌 Pinned' : '📌 Pin';
          });
        }

        const settingsBtn = container.querySelector('#ov-settings-btn');
        if (settingsBtn) {
          settingsBtn.addEventListener('click', () => {
            if (chrome.runtime.openOptionsPage) {
              chrome.runtime.openOptionsPage();
            } else {
              window.open(chrome.runtime.getURL('options.html'));
            }
          });
        }

        // Reasoning expand on click
        const reasoning = container.querySelector('#ov-reasoning');
        if (reasoning) {
          reasoning.addEventListener('click', () => {
            reasoning.classList.toggle('expanded');
            (reasoning as HTMLElement).style.maxHeight = reasoning.classList.contains('expanded') ? 'none' : '60px';
          });
        }
      }, 0);

      // Drag header
      const header = container.querySelector('.overlay-header') as HTMLElement;
      if (header) {
        header.addEventListener('mousedown', this.handleMouseDown);
      }
      document.addEventListener('mousemove', this.handleMouseMove);
      document.addEventListener('mouseup', this.handleMouseUp);

      this.isInitialized = true;
      console.log('[Overlay] Premium overlay initialized');
    } catch (error) {
      console.error('[Overlay] Initialization failed:', error);
    }
  }

  destroy(): void {
    if (this.overlayContainer && this.overlayContainer.parentNode) {
      this.overlayContainer.parentNode.removeChild(this.overlayContainer);
    }
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    this.isInitialized = false;
  }

  async show(): Promise<void> {
    if (!this.overlayContainer) await this.initialize();
    if (this.overlayContainer) {
      this.overlayContainer.style.display = 'block';
      this.isVisible = true;
    }
  }

  async hide(): Promise<void> {
    if (this.overlayContainer) {
      this.overlayContainer.style.display = 'none';
      this.isVisible = false;
    }
  }

  async showLoading(message = 'Analyzing...'): Promise<void> {
    if (!this.overlayContainer) return;
    await this.show();

    const recBox = this.overlayContainer.querySelector('#ov-rec-box') as HTMLElement;
    const recText = this.overlayContainer.querySelector('#ov-rec-text') as HTMLElement;
    const recSub = this.overlayContainer.querySelector('#ov-rec-sub') as HTMLElement;
    const confFill = this.overlayContainer.querySelector('#ov-conf-fill') as HTMLElement;

    if (recBox) recBox.style.background = 'rgba(33,38,45,0.85)';
    if (recText) { recText.textContent = 'ANALYZING'; recText.style.color = '#e6edf3'; }
    if (recSub) recSub.textContent = message;
    if (confFill) confFill.style.width = '0%';
  }

  async showError(errorMessage: string): Promise<void> {
    if (!this.overlayContainer) return;
    await this.show();

    const recBox = this.overlayContainer.querySelector('#ov-rec-box') as HTMLElement;
    const recText = this.overlayContainer.querySelector('#ov-rec-text') as HTMLElement;
    const recSub = this.overlayContainer.querySelector('#ov-rec-sub') as HTMLElement;

    if (recBox) recBox.style.background = 'rgba(248,81,73,0.15)';
    if (recText) { recText.textContent = 'ERROR'; recText.style.color = '#f85149'; }
    if (recSub) recSub.textContent = errorMessage;
  }

  async updateAnalysis(result: any): Promise<void> {
    if (!this.overlayContainer) return;

    const symbol = this.overlayContainer.querySelector('#ov-symbol') as HTMLElement;
    const timeframe = this.overlayContainer.querySelector('#ov-timeframe') as HTMLElement;
    const price = this.overlayContainer.querySelector('#ov-price') as HTMLElement;
    const recBox = this.overlayContainer.querySelector('#ov-rec-box') as HTMLElement;
    const recText = this.overlayContainer.querySelector('#ov-rec-text') as HTMLElement;
    const recSub = this.overlayContainer.querySelector('#ov-rec-sub') as HTMLElement;
    const confFill = this.overlayContainer.querySelector('#ov-conf-fill') as HTMLElement;
    const entry = this.overlayContainer.querySelector('#ov-entry') as HTMLElement;
    const sl = this.overlayContainer.querySelector('#ov-sl') as HTMLElement;
    const tp = this.overlayContainer.querySelector('#ov-tp') as HTMLElement;
    const rr = this.overlayContainer.querySelector('#ov-rr') as HTMLElement;
    const riskEl = this.overlayContainer.querySelector('#ov-risk') as HTMLElement;
    const durationEl = this.overlayContainer.querySelector('#ov-duration') as HTMLElement;
    const reasoning = this.overlayContainer.querySelector('#ov-reasoning') as HTMLElement;
    const risksSection = this.overlayContainer.querySelector('#ov-risks-section') as HTMLElement;
    const risksList = this.overlayContainer.querySelector('#ov-risks-list') as HTMLElement;

    const rec = (result.recommendation || 'HOLD').toUpperCase();
    const conf = result.confidence ?? 50;
    const currentPrice = result.currentPrice ?? (result.engines?.technical?.indicators?.atr ?? 0);
    const tradePlan = result.engines?.tradePlanning?.tradeSetup;
    const riskData = result.engines?.risk;
    const aiExplanation = result.engines?.aiExplanation;
    const userReasoning = result.reasoning || '';

    // Symbol & Timeframe
    if (symbol) symbol.textContent = result.symbol || '---';
    if (timeframe) timeframe.textContent = result.timeframe || '---';

    // Price
    if (price) price.textContent = currentPrice ? this.formatPrice(currentPrice) : '---';

    // Recommendation box
    const isBuy = rec === 'BUY' || rec === 'STRONG_BUY';
    const isSell = rec === 'SELL' || rec === 'STRONG_SELL';
    let bgGradient = 'linear-gradient(135deg, #9e6a03, #d29922)';
    if (isBuy) bgGradient = 'linear-gradient(135deg, #238636, #2ea043)';
    if (isSell) bgGradient = 'linear-gradient(135deg, #da3633, #f85149)';

    if (recBox) recBox.style.background = bgGradient;
    if (recText) { recText.textContent = rec; recText.style.color = '#fff'; }
    if (recSub) recSub.textContent = `${Math.round(conf)}% Confidence`;
    if (confFill) confFill.style.width = `${Math.round(conf)}%`;

    // Trade Setup — validate every numeric field before calling .toFixed()
    // formatPrice() already has typeof/isFinite guards, so passing undefined returns '---' safely
    if (entry) {
      entry.textContent = this.formatPrice(tradePlan?.entryPrice);
    }
    if (sl) {
      sl.textContent = this.formatPrice(tradePlan?.stopLoss);
    }
    if (tp) {
      tp.textContent = this.formatPrice(tradePlan?.takeProfit);
    }
    if (rr) {
      const rrVal = tradePlan?.riskRewardRatio;
      rr.textContent = (typeof rrVal === 'number' && Number.isFinite(rrVal))
        ? `${rrVal.toFixed(2)}:1`
        : '---';
    }
    if (riskEl) riskEl.textContent = riskData?.riskLevel || '---';
    if (durationEl) durationEl.textContent = tradePlan?.maxHoldTime || '---';

    // Reasoning
    if (reasoning) {
      const fullReasoning = aiExplanation?.explanation
        ? `${userReasoning}\n\n${aiExplanation.explanation}`
        : (userReasoning || 'No reasoning available.');
      reasoning.textContent = fullReasoning;
      reasoning.style.maxHeight = '60px';
      reasoning.classList.remove('expanded');
    }

    // Risks
    const risks = aiExplanation?.risks || [];
    if (risks.length > 0 && risksList) {
      risksSection.style.display = 'block';
      risksList.innerHTML = risks.map((r: string) =>
        `<div style="display:flex;align-items:start;gap:6px;font-size:10px;color:#8b949e;padding:3px 6px;background:rgba(248,81,73,0.08);border-radius:3px;border-left:2px solid #f85149;margin-bottom:2px;">
          <span style="color:#f85149;font-size:10px;">⚠</span>
          <span>${r}</span>
        </div>`
      ).join('');
    } else {
      risksSection.style.display = 'none';
    }

    await this.show();
  }

  async update(data: any): Promise<void> {
    if (data?.analysisResult) {
      await this.updateAnalysis(data.analysisResult);
    } else if (data?.loading) {
      await this.showLoading(data.message);
    } else if (data?.error) {
      await this.showError(data.error);
    } else if (data?.visible !== undefined) {
      data.visible ? await this.show() : await this.hide();
    }
  }

  private handleMouseDown = (e: MouseEvent): void => {
    if (!this.overlayContainer) return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON') return;

    this.isDragging = true;
    const rect = this.overlayContainer.getBoundingClientRect();
    this.dragOffsetX = e.clientX - rect.left;
    this.dragOffsetY = e.clientY - rect.top;
    e.preventDefault();
  };

  private handleMouseMove = (e: MouseEvent): void => {
    if (!this.isDragging || !this.overlayContainer) return;
    const now = Date.now();
    if (now - this.lastDragTime < this.DRAG_THROTTLE_MS) return;
    this.lastDragTime = now;

    const left = Math.max(0, Math.min(e.clientX - this.dragOffsetX, window.innerWidth - this.overlayContainer.offsetWidth));
    const top = Math.max(0, Math.min(e.clientY - this.dragOffsetY, window.innerHeight - this.overlayContainer.offsetHeight));
    this.overlayContainer.style.left = `${left}px`;
    this.overlayContainer.style.top = `${top}px`;
    this.overlayContainer.style.right = 'auto';
  };

  private handleMouseUp = (): void => {
    this.isDragging = false;
  };

  private formatPrice(price: number): string {
    if (typeof price !== 'number' || !isFinite(price)) return '---';
    if (price < 1) return price.toFixed(6);
    if (price < 100) return price.toFixed(4);
    if (price < 10000) return price.toFixed(2);
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
