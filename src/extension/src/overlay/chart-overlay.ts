/**
 * Enhanced Chart Overlay Component
 * Premium dark-mode overlay with full trade setup display.
 */

import type { AnalysisResult } from '../shared/types';

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
        -webkit-font-smoothing: antialiased;
      `;

      container.innerHTML = `
        <div id="overlay-container" style="
          width: 300px;
          font-family: 'SF Mono','Fira Code','Consolas','Roboto Mono',monospace;
          font-size: 11px;
          background: rgba(10,13,18,0.95);
          border: 1px solid rgba(56,68,84,0.4);
          border-radius: 6px;
          overflow: hidden;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          box-shadow: 0 8px 40px rgba(0,0,0,0.6);
          color: #d4dcec;
        ">
          <div class="ov-header" style="
            display:flex;align-items:center;justify-content:space-between;
            padding:8px 12px;
            background: linear-gradient(135deg, #0f1729, #131d31);
            border-bottom:1px solid rgba(56,68,84,0.3);
            cursor:move;user-select:none;
          ">
            <div style="display:flex;align-items:center;gap:6px;">
              <span id="ov-symbol" style="font-size:14px;font-weight:700;letter-spacing:0.3px;">---</span>
              <span id="ov-timeframe" style="
                font-size:9px;color:#556577;
                background:rgba(30,42,61,0.9);
                padding:1px 5px;border-radius:3px;
                border:1px solid rgba(56,68,84,0.2);
              ">---</span>
            </div>
            <div style="display:flex;gap:3px;">
              <button id="ov-pin-btn" style="
                background:none;border:1px solid transparent;
                color:#556577;font-size:10px;cursor:pointer;
                padding:2px 5px;border-radius:3px;
                transition:all 0.15s;
              " title="Pin overlay">📌</button>
              <button id="ov-close-btn" style="
                background:none;border:1px solid transparent;
                color:#556577;font-size:12px;cursor:pointer;
                padding:2px 5px;border-radius:3px;
                transition:all 0.15s;
              " title="Close overlay">✕</button>
            </div>
          </div>

          <div style="padding:10px 12px;">
            <!-- Signal Box -->
            <div id="ov-rec-box" style="
              position:relative;overflow:hidden;
              text-align:center;padding:8px;
              margin-bottom:8px;border-radius:5px;
              background:rgba(24,32,42,0.9);
              border:1px solid rgba(56,68,84,0.15);
            ">
              <div id="ov-rec-bg" style="
                position:absolute;top:0;left:0;right:0;bottom:0;
                opacity:0.06;transition:background 0.5s;
              "></div>
              <div style="position:relative;z-index:1;">
                <div id="ov-rec-text" style="
                  font-size:20px;font-weight:800;
                  letter-spacing:2px;color:#556577;
                  transition:color 0.3s;
                ">ANALYZING</div>
                <div id="ov-rec-sub" style="
                  font-size:10px;color:#556577;
                  margin-top:2px;
                ">Computing signals...</div>
                <div style="
                  width:100%;height:2px;
                  background:rgba(255,255,255,0.06);
                  border-radius:2px;overflow:hidden;
                  margin:6px 0 0;
                ">
                  <div id="ov-conf-fill" style="
                    height:100%;border-radius:2px;
                    transition:width 0.6s cubic-bezier(0.22,1,0.36,1);
                    width:0%;background:#556577;
                  "></div>
                </div>
              </div>
            </div>

            <!-- Price Row -->
            <div style="
              display:flex;align-items:center;justify-content:space-between;
              padding:4px 0;margin-bottom:6px;
              border-bottom:1px solid rgba(56,68,84,0.15);
            ">
              <span style="font-size:9px;color:#556577;text-transform:uppercase;letter-spacing:0.5px;">Price</span>
              <span id="ov-price" style="font-size:16px;font-weight:600;color:#d4dcec;">---</span>
            </div>

            <!-- Trade Setup Grid -->
            <div id="ov-setup-grid" style="
              display:grid;grid-template-columns:1fr 1fr;gap:2px;
              margin-bottom:6px;
            ">
              <div class="ov-item" style="display:flex;justify-content:space-between;padding:4px 6px;background:rgba(24,32,42,0.8);border-radius:3px;font-size:10px;">
                <span style="color:#556577;">Entry</span>
                <span id="ov-entry" style="font-weight:600;color:#26c66a;">---</span>
              </div>
              <div class="ov-item" style="display:flex;justify-content:space-between;padding:4px 6px;background:rgba(24,32,42,0.8);border-radius:3px;font-size:10px;">
                <span style="color:#556577;">Stop</span>
                <span id="ov-sl" style="font-weight:600;color:#f25c5c;">---</span>
              </div>
              <div class="ov-item" style="display:flex;justify-content:space-between;padding:4px 6px;background:rgba(24,32,42,0.8);border-radius:3px;font-size:10px;">
                <span style="color:#556577;">TP</span>
                <span id="ov-tp" style="font-weight:600;color:#26c66a;">---</span>
              </div>
              <div class="ov-item" style="display:flex;justify-content:space-between;padding:4px 6px;background:rgba(24,32,42,0.8);border-radius:3px;font-size:10px;">
                <span style="color:#556577;">R:R</span>
                <span id="ov-rr" style="font-weight:600;color:#e8a838;">---</span>
              </div>
            </div>

            <!-- Reasoning -->
            <div style="font-size:8px;color:#556577;text-transform:uppercase;letter-spacing:0.8px;margin:6px 0 3px;">Analysis</div>
            <div id="ov-reasoning" style="
              font-size:10px;color:#8895aa;line-height:1.5;
              padding:5px 7px;background:rgba(24,32,42,0.8);
              border-radius:3px;max-height:48px;overflow:hidden;
              cursor:pointer;transition:max-height 0.3s;
              font-family:inherit;
            ">No analysis yet.</div>

            <!-- Risks -->
            <div id="ov-risks-section" style="display:none;margin-top:6px;">
              <div style="font-size:8px;color:#556577;text-transform:uppercase;letter-spacing:0.8px;margin:0 0 3px;">Risks</div>
              <div id="ov-risks-list"></div>
            </div>
          </div>

          <div style="
            display:flex;align-items:center;justify-content:flex-end;gap:2px;
            padding:5px 12px;
            background:rgba(17,22,30,0.95);
            border-top:1px solid rgba(56,68,84,0.2);
          ">
            <button id="ov-reanalyze-btn" style="
              background:none;border:none;
              color:#556577;font-size:10px;cursor:pointer;
              padding:3px 8px;border-radius:3px;
              font-family:inherit;transition:color 0.15s;
            " title="Re-analyze current chart">🔄 Re-analyze</button>
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
            // Read current symbol from the overlay DOM to include in payload
            const ovSymbol = container.querySelector('#ov-symbol')?.textContent || '';
            const ovTimeframe = container.querySelector('#ov-timeframe')?.textContent || '';
            const payload: any = { force: true };
            if (ovSymbol && ovSymbol !== '---') {
              payload.symbol = ovSymbol;
            }
            if (ovTimeframe && ovTimeframe !== '---') {
              payload.timeframe = ovTimeframe;
            }
            this.showLoading('Re-analyzing...');
            chrome.runtime.sendMessage({ type: 'REQUEST_ANALYSIS', payload }, () => {
              // On error (e.g. background not responding), overlay stays in loading state
              // The background will send UPDATE_OVERLAY when analysis completes.
              // If sendMessage itself fails, reset the overlay display.
              if (chrome.runtime.lastError) {
                console.warn('[Overlay] Re-analyze request failed:', chrome.runtime.lastError.message);
                this.showError('Analysis request failed. Check your connection.');
              }
            });
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
      const header = container.querySelector('.ov-header') as HTMLElement;
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
    // Remove drag-header mousedown listener before removing the container
    if (this.overlayContainer) {
      const header = this.overlayContainer.querySelector('.overlay-header') as HTMLElement;
      if (header && header.removeEventListener) {
        header.removeEventListener('mousedown', this.handleMouseDown);
      }
      if (this.overlayContainer.parentNode) {
        this.overlayContainer.parentNode.removeChild(this.overlayContainer);
      }
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

  async updateAnalysis(result: AnalysisResult): Promise<void> {
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
    const reasoning = this.overlayContainer.querySelector('#ov-reasoning') as HTMLElement;
    const risksSection = this.overlayContainer.querySelector('#ov-risks-section') as HTMLElement;
    const risksList = this.overlayContainer.querySelector('#ov-risks-list') as HTMLElement;

    const rec = (result.recommendation || 'HOLD').toUpperCase();
    const conf = result.confidence ?? 50;
    const currentPrice = result.currentPrice ?? (result.engines?.technical?.indicators?.atr ?? 0);
    const tradePlan = result.engines?.tradePlanning?.tradeSetup;
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


    // Reasoning
    if (reasoning) {
      const fullReasoning = aiExplanation?.explanation
        ? `${userReasoning}\n\n${aiExplanation.explanation}`
        : (userReasoning || 'No reasoning available.');
      reasoning.textContent = fullReasoning;
      reasoning.style.maxHeight = '60px';
      reasoning.classList.remove('expanded');
    }

    // Risks — use textContent to prevent XSS when rendering AI-generated content
    const risks = aiExplanation?.risks || [];
    if (risks.length > 0 && risksList) {
      risksSection.style.display = 'block';
      risksList.textContent = ''; // Clear existing content
      // Use DOM API (not innerHTML) for AI-generated content to prevent XSS
      for (const riskText of risks) {
        const riskEl = document.createElement('div');
        riskEl.style.cssText = 'display:flex;align-items:start;gap:6px;font-size:10px;color:#8b949e;padding:3px 6px;background:rgba(248,81,73,0.08);border-radius:3px;border-left:2px solid #f85149;margin-bottom:2px;';
        const iconSpan = document.createElement('span');
        iconSpan.style.cssText = 'color:#f85149;font-size:10px;';
        iconSpan.textContent = '⚠';
        const textSpan = document.createElement('span');
        textSpan.textContent = riskText;
        riskEl.appendChild(iconSpan);
        riskEl.appendChild(textSpan);
        risksList.appendChild(riskEl);
      }
    } else {
      risksSection.style.display = 'none';
    }

    await this.show();
  }

  async update(data: { analysisResult?: AnalysisResult; loading?: boolean; message?: string; error?: string; visible?: boolean }): Promise<void> {
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

  private formatPrice(price: number | undefined | null): string {
    if (typeof price !== 'number' || !isFinite(price)) return '---';
    if (price < 1) return price.toFixed(6);
    if (price < 100) return price.toFixed(4);
    if (price < 10000) return price.toFixed(2);
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
