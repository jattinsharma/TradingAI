/**
 * Pattern Recognition Engine
 *
 * Detects candlestick patterns from real OHLCV data.
 * Fully deterministic: same candles → same patterns always.
 * No random values. No simulated patterns.
 */

export interface PatternResult {
  signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  strength: number;       // 0-1
  patterns: string[];     // Detected patterns
}

export class PatternRecognitionEngine {
  async analyze(symbol: string, timeframe: string, data?: { open: number[]; high: number[]; low: number[]; close: number[]; volume: number[] }): Promise<PatternResult> {
    // We need at least 5 candles to detect patterns
    if (!data || !data.close || data.close.length < 5) {
      return { signal: 'NEUTRAL', strength: 0.3, patterns: ['INSUFFICIENT_DATA'] };
    }

    const { open, high, low, close } = data;
    const patterns: string[] = [];
    const lastIdx = close.length - 1;
    let bullishSignal = 0;
    let bearishSignal = 0;

    // ── 1. Engulfing Pattern ──
    if (lastIdx >= 2) {
      const prevBullish = close[lastIdx - 1] > open[lastIdx - 1];
      const currBullish = close[lastIdx] > open[lastIdx];
      const prevBody = Math.abs(close[lastIdx - 1] - open[lastIdx - 1]);
      const currBody = Math.abs(close[lastIdx] - open[lastIdx]);

      if (prevBullish === false && currBullish === true && currBody > prevBody * 1.2) {
        // Bullish engulfing
        patterns.push('BULLISH_ENGULFING');
        bullishSignal += 0.6;
      } else if (prevBullish === true && currBullish === false && currBody > prevBody * 1.2) {
        // Bearish engulfing
        patterns.push('BEARISH_ENGULFING');
        bearishSignal += 0.6;
      }
    }

    // ── 2. Doji (indecision) ──
    if (lastIdx >= 0) {
      const body = Math.abs(close[lastIdx] - open[lastIdx]);
      const range = high[lastIdx] - low[lastIdx];
      if (range > 0 && body / range < 0.1) {
        patterns.push('DOJI');
        // Doji signals indecision — slight edge to current trend
        bearishSignal += 0.1;
        bullishSignal += 0.1;
      }
    }

    // ── 3. Hammer / Shooting Star ──
    if (lastIdx >= 0) {
      const body = Math.abs(close[lastIdx] - open[lastIdx]);
      const upperWick = high[lastIdx] - Math.max(open[lastIdx], close[lastIdx]);
      const lowerWick = Math.min(open[lastIdx], close[lastIdx]) - low[lastIdx];
      const totalRange = high[lastIdx] - low[lastIdx];

      if (totalRange > 0) {
        // Hammer: small body at top, long lower wick (>= 2x body)
        if (lowerWick >= body * 2 && upperWick <= body * 0.3) {
          patterns.push('HAMMER');
          bullishSignal += 0.5;
        }
        // Shooting Star: small body at bottom, long upper wick (>= 2x body)
        if (upperWick >= body * 2 && lowerWick <= body * 0.3) {
          patterns.push('SHOOTING_STAR');
          bearishSignal += 0.5;
        }
      }
    }

    // ── 4. Three White Soldiers / Three Black Crows ──
    if (lastIdx >= 3) {
      let consecutiveBullish = 0;
      let consecutiveBearish = 0;
      for (let i = lastIdx - 2; i <= lastIdx; i++) {
        if (close[i] > open[i]) consecutiveBullish++;
        else consecutiveBearish++;
      }
      if (consecutiveBullish >= 3) {
        patterns.push('THREE_WHITE_SOLDIERS');
        bullishSignal += 0.5;
      } else if (consecutiveBearish >= 3) {
        patterns.push('THREE_BLACK_CROWS');
        bearishSignal += 0.5;
      }
    }

    // ── 5. Morning Star / Evening Star (3-bar pattern) ──
    if (lastIdx >= 3) {
      // Morning Star: bearish → small body (doji) → bullish closing above midpoint of first bar
      const bar1Bearish = close[lastIdx - 2] < open[lastIdx - 2];
      const bar2Small = Math.abs(close[lastIdx - 1] - open[lastIdx - 1]) < Math.abs(high[lastIdx - 1] - low[lastIdx - 1]) * 0.3;
      const bar3Bullish = close[lastIdx] > open[lastIdx];
      const bar3AboveMid = close[lastIdx] > (high[lastIdx - 2] + low[lastIdx - 2]) / 2;

      if (bar1Bearish && bar2Small && bar3Bullish && bar3AboveMid) {
        patterns.push('MORNING_STAR');
        bullishSignal += 0.7;
      }

      // Evening Star: bullish → small body → bearish closing below midpoint
      const bar1Bullish = close[lastIdx - 2] > open[lastIdx - 2];
      const bar3Bearish = close[lastIdx] < open[lastIdx];
      const bar3BelowMid = close[lastIdx] < (high[lastIdx - 2] + low[lastIdx - 2]) / 2;

      if (bar1Bullish && bar2Small && bar3Bearish && bar3BelowMid) {
        patterns.push('EVENING_STAR');
        bearishSignal += 0.7;
      }
    }

    // ── 6. Bullish / Bearish Harami ──
    if (lastIdx >= 2) {
      const prevBody = Math.abs(close[lastIdx - 1] - open[lastIdx - 1]);
      const currBody = Math.abs(close[lastIdx] - open[lastIdx]);
      const prevRange = high[lastIdx - 1] - low[lastIdx - 1];

      if (prevRange > 0 && currBody < prevBody) {
        const prevCloseAboveOpen = close[lastIdx - 1] > open[lastIdx - 1];
        const currBullish = close[lastIdx] > open[lastIdx];
        const currWithinPrevRange = high[lastIdx] < high[lastIdx - 1] && low[lastIdx] > low[lastIdx - 1];

        if (currWithinPrevRange) {
          if (prevCloseAboveOpen && currBullish === false) {
            patterns.push('BEARISH_HARAMI');
            bearishSignal += 0.3;
          } else if (prevCloseAboveOpen === false && currBullish) {
            patterns.push('BULLISH_HARAMI');
            bullishSignal += 0.3;
          }
        }
      }
    }

    // ── Determine final signal ──
    const net = bullishSignal - bearishSignal;
    let signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    let strength: number;

    if (net > 0.4) {
      signal = 'BULLISH';
      strength = Math.min(0.9, 0.3 + net * 0.4);
    } else if (net < -0.4) {
      signal = 'BEARISH';
      strength = Math.min(0.9, 0.3 + Math.abs(net) * 0.4);
    } else {
      signal = 'NEUTRAL';
      strength = 0.3 + Math.abs(net) * 0.5; // 0.3-0.5
    }

    // No patterns detected at all
    if (patterns.length === 0) {
      patterns.push('NONE');
      strength = 0.3;
    }

    return {
      signal,
      strength: Math.round(strength * 100) / 100,
      patterns,
    };
  }
}
