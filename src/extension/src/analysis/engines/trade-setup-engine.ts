/**
 * Trade Setup Engine
 *
 * Calculates entry price, stop loss, take profit levels, and risk/reward ratio
 * from real market data. Uses ATR for volatility-adjusted levels.
 *
 * Fully deterministic: same input → same output every time.
 * No random values. No simulated levels.
 */

export interface TradeSetupInput {
  close: number;           // Current/latest close price
  high: number;            // Current high
  low: number;             // Current low
  atr: number;            // Latest ATR value
  direction: 'BUY' | 'SELL' | 'HOLD' | 'STRONG_BUY' | 'STRONG_SELL';
  bollingerUpper: number;
  bollingerLower: number;
  sma20: number;
  sma50: number;
  sma200: number;         // Optional — may be NaN if insufficient data
  highest50: number;      // Highest high over last 50 bars
  lowest50: number;       // Lowest low over last 50 bars
}

export interface TradeSetup {
  entry: number;
  stopLoss: number;
  takeProfit1: number;    // Primary TP (1.5-2x risk)
  takeProfit2: number;    // Secondary TP (3x risk) — optional
  riskReward: number;     // R:R ratio based on TP1
  riskPercent: number;    // Risk as % of price
  setupConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
  atrMultiplier: number;  // Which ATR multiplier was used
}

export class TradeSetupEngine {
  /**
   * Calculate a complete trade setup from market data.
   * Uses ATR for dynamic stop placement and profit targeting.
   */
  calculate(input: TradeSetupInput): TradeSetup {
    const { close, atr, direction, bollingerUpper, bollingerLower, highest50, lowest50, sma20 } = input;

    // ── Defensive defaults ──
    if (!isFinite(close) || !isFinite(atr) || atr <= 0) {
      return {
        entry: close || 0,
        stopLoss: 0,
        takeProfit1: 0,
        takeProfit2: 0,
        riskReward: 0,
        riskPercent: 0,
        setupConfidence: 'LOW',
        atrMultiplier: 0,
      };
    }

    const isBullish = direction === 'BUY' || direction === 'STRONG_BUY';
    const isHolding = direction === 'HOLD';

    // ── ATR multiplier selection ──
    // Tighter in low-volatility, wider in high-volatility
    const atrPct = atr / close;
    const multiplier = atrPct < 0.01 ? 1.0 : atrPct < 0.02 ? 1.5 : atrPct < 0.04 ? 2.0 : 2.5;

    // ── Entry price ──
    // For BUY: current price (market order). For SELL: current price.
    // In production, could calculate limit entry based on pullback to support/MA
    const entry = close;

    // ── Stop Loss ──
    let stopLoss: number;
    if (isHolding) {
      stopLoss = 0;
    } else if (isBullish) {
      // SL below: lowest of (lowest50, bollingerLower, entry - ATR*multiplier)
      const atrStop = entry - atr * multiplier;
      const structuralStop = Math.min(
        isFinite(bollingerLower) ? bollingerLower : Infinity,
        isFinite(lowest50) ? lowest50 : Infinity,
      );
      stopLoss = Math.min(atrStop, structuralStop);
      // Never put SL more than 2x ATR*multiplier away
      stopLoss = Math.max(stopLoss, entry - atr * multiplier * 2);
    } else {
      // SELL: SL above
      const atrStop = entry + atr * multiplier;
      const structuralStop = Math.max(
        isFinite(bollingerUpper) ? bollingerUpper : -Infinity,
        isFinite(highest50) ? highest50 : -Infinity,
      );
      stopLoss = Math.max(atrStop, structuralStop);
      stopLoss = Math.min(stopLoss, entry + atr * multiplier * 2);
    }

    // ── Take Profit levels ──
    const risk = Math.abs(entry - stopLoss);
    let takeProfit1: number;
    let takeProfit2: number;
    let riskReward: number;

    if (risk === 0 || !isFinite(risk)) {
      takeProfit1 = 0;
      takeProfit2 = 0;
      riskReward = 0;
    } else {
      if (isBullish) {
        takeProfit1 = entry + risk * 2;   // 2:1 risk-reward
        takeProfit2 = entry + risk * 3;   // 3:1 risk-reward
      } else {
        takeProfit1 = entry - risk * 2;
        takeProfit2 = entry - risk * 3;
      }
      riskReward = 2.0; // Fixed at 2:1 for TP1
    }

    // ── Setup confidence score ──
    // Higher confidence when: ATR is reasonable, structural SL matches ATR SL, R:R is favorable
    const atrStopDiff = isBullish
      ? Math.abs(stopLoss - (entry - atr * multiplier))
      : Math.abs(stopLoss - (entry + atr * multiplier));
    const atrStopAligned = atrStopDiff < atr * 0.5;
    const riskPercent = risk / entry;
    const riskReasonable = riskPercent > 0.003 && riskPercent < 0.10; // 0.3% – 10%

    let setupConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
    if (atrStopAligned && riskReasonable && risk > 0) {
      setupConfidence = 'HIGH';
    } else if (riskReasonable && risk > 0) {
      setupConfidence = 'MEDIUM';
    } else {
      setupConfidence = 'LOW';
    }

    return {
      entry: roundToCents(entry),
      stopLoss: roundToCents(stopLoss),
      takeProfit1: roundToCents(takeProfit1),
      takeProfit2: roundToCents(takeProfit2),
      riskReward,
      riskPercent: Math.round(riskPercent * 10000) / 100, // e.g. 2.5%
      setupConfidence,
      atrMultiplier: multiplier,
    };
  }
}

function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}
