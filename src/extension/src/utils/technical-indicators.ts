// Technical Indicators Library
// Implements various technical analysis calculations using only price/volume data

export class TechnicalIndicators {
  /**
   * Calculate Simple Moving Average (SMA)
   * @param data Array of numbers (typically closing prices)
   * @param period Number of periods for the average
   * @returns Array of SMA values (same length as input, with NaN for insufficient data)
   */
  static sma(data: number[], period: number): number[] {
    if (period <= 0 || data.length < period) {
      return Array(data.length).fill(NaN);
    }

    const result: number[] = Array(data.length).fill(NaN);
    let sum = 0;

    // Calculate sum of first 'period' elements
    for (let i = 0; i < period; i++) {
      sum += data[i];
    }
    result[period - 1] = sum / period;

    // Calculate rolling sum for remaining elements
    for (let i = period; i < data.length; i++) {
      sum = sum - data[i - period] + data[i];
      result[i] = sum / period;
    }

    return result;
  }

  /**
   * Calculate Exponential Moving Average (EMA)
   * @param data Array of numbers (typically closing prices)
   * @param period Number of periods for the average
   * @returns Array of EMA values (same length as input)
   */
  static ema(data: number[], period: number): number[] {
    if (period <= 0 || data.length === 0) {
      return Array(data.length).fill(NaN);
    }

    const result: number[] = Array(data.length).fill(NaN);
    const multiplier = 2 / (period + 1);

    // First EMA is simply the first data point (or SMA of first period)
    result[0] = data[0];

    // Calculate EMA for remaining points
    for (let i = 1; i < data.length; i++) {
      result[i] = (data[i] - result[i - 1]) * multiplier + result[i - 1];
    }

    return result;
  }

  /**
   * Calculate Moving Average Convergence Divergence (MACD)
   * @param data Array of numbers (typically closing prices)
   * @param fastPeriod Fast EMA period (default: 12)
   * @param slowPeriod Slow EMA period (default: 26)
   * @param signalPeriod Signal line EMA period (default: 9)
   * @returns Object containing MACD line, signal line, and histogram
   */
  static macd(
    data: number[],
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9
  ): {
    macd: number[];
    signal: number[];
    histogram: number[];
  } {
    if (data.length < slowPeriod) {
      const empty = Array(data.length).fill(NaN);
      return { macd: [...empty], signal: [...empty], histogram: [...empty] };
    }

    const fastEMA = this.ema(data, fastPeriod);
    const slowEMA = this.ema(data, slowPeriod);

    // Calculate MACD line: fastEMA - slowEMA
    const macdLine: number[] = data.map((_, i) =>
      isNaN(fastEMA[i]) || isNaN(slowEMA[i]) ? NaN : fastEMA[i] - slowEMA[i]
    );

    // Calculate signal line: EMA of MACD line
    const signalLine = this.ema(macdLine.filter(v => !isNaN(v)), signalPeriod);
    // Pad the beginning with NaN to match original array length
    const paddedSignal: number[] = Array(data.length - signalLine.length).fill(NaN).concat(signalLine);

    // Calculate histogram: MACD line - signal line
    const histogram: number[] = data.map((_, i) =>
      isNaN(macdLine[i]) || isNaN(paddedSignal[i]) ? NaN : macdLine[i] - paddedSignal[i]
    );

    return { macd: macdLine, signal: paddedSignal, histogram };
  }

  /**
   * Calculate Relative Strength Index (RSI)
   * @param data Array of numbers (typically closing prices)
   * @param period Number of periods for RSI calculation (default: 14)
   * @returns Array of RSI values (0-100)
   */
  static rsi(data: number[], period: number = 14): number[] {
    if (period <= 0 || data.length < period + 1) {
      return Array(data.length).fill(NaN);
    }

    const result: number[] = Array(data.length).fill(NaN);
    const gains: number[] = Array(data.length).fill(0);
    const losses: number[] = Array(data.length).fill(0);

    // Calculate price changes
    for (let i = 1; i < data.length; i++) {
      const change = data[i] - data[i - 1];
      if (change >= 0) {
        gains[i] = change;
        losses[i] = 0;
      } else {
        gains[i] = 0;
        losses[i] = -change;
      }
    }

    // Calculate average gain and loss for first period
    let avgGain = gains.slice(1, period + 1).reduce((sum, val) => sum + val, 0) / period;
    let avgLoss = losses.slice(1, period + 1).reduce((sum, val) => sum + val, 0) / period;

    // First RSI value
    if (avgLoss === 0) {
      result[period] = 100;
    } else {
      const rs = avgGain / avgLoss;
      result[period] = 100 - (100 / (1 + rs));
    }

    // Calculate subsequent RSI values using Wilder's smoothing
    for (let i = period + 1; i < data.length; i++) {
      avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
      avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;

      if (avgLoss === 0) {
        result[i] = 100;
      } else {
        const rs = avgGain / avgLoss;
        result[i] = 100 - (100 / (1 + rs));
      }
    }

    return result;
  }

  /**
   * Calculate Bollinger Bands
   * @param data Array of numbers (typically closing prices)
   * @param period Number of periods for moving average (default: 20)
   * @param stdDev Number of standard deviations for bands (default: 2)
   * @returns Object containing upper band, middle band (SMA), and lower band
   */
  static bollingerBands(
    data: number[],
    period: number = 20,
    stdDev: number = 2
  ): {
    upper: number[];
    middle: number[];
    lower: number[];
  } {
    const sma = this.sma(data, period);
    const result: { upper: number[]; middle: number[]; lower: number[] } = {
      upper: Array(data.length).fill(NaN),
      middle: [...sma],
      lower: Array(data.length).fill(NaN)
    };

    // Calculate standard deviation for each point
    for (let i = period - 1; i < data.length; i++) {
      const periodData = data.slice(i - period + 1, i + 1);
      const mean = sma[i];

      if (isNaN(mean)) continue;

      let variance = 0;
      for (let j = 0; j < periodData.length; j++) {
        variance += Math.pow(periodData[j] - mean, 2);
      }
      variance /= period;
      const stdDeviation = Math.sqrt(variance);

      result.upper[i] = mean + (stdDeviation * stdDev);
      result.lower[i] = mean - (stdDeviation * stdDev);
    }

    return result;
  }

  /**
   * Calculate Average True Range (ATR)
   * @param high Array of high prices
   * @param low Array of low prices
   * @param close Array of closing prices
   * @param period Number of periods for ATR calculation (default: 14)
   * @returns Array of ATR values
   */
  static atr(
    high: number[],
    low: number[],
    close: number[],
    period: number = 14
  ): number[] {
    if (high.length !== low.length || low.length !== close.length || high.length < 2) {
      return Array(high.length).fill(NaN);
    }

    if (period <= 0) {
      return Array(high.length).fill(NaN);
    }

    const trueRanges: number[] = Array(high.length).fill(0);
    const result: number[] = Array(high.length).fill(NaN);

    // Calculate True Range for each period
    for (let i = 0; i < high.length; i++) {
      const highLow = high[i] - low[i];
      const highClosePrev = Math.abs(high[i] - (i > 0 ? close[i - 1] : close[i]));
      const lowClosePrev = Math.abs(low[i] - (i > 0 ? close[i - 1] : close[i]));

      trueRanges[i] = Math.max(highLow, highClosePrev, lowClosePrev);
    }

    // Calculate ATR using Wilder's smoothing (similar to RSI)
    if (high.length >= period) {
      // First ATR value is average of first 'period' true ranges
      let sumTR = 0;
      for (let i = 0; i < period; i++) {
        sumTR += trueRanges[i];
      }
      result[period - 1] = sumTR / period;

      // Subsequent ATR values
      for (let i = period; i < high.length; i++) {
        result[i] = ((result[i - 1] * (period - 1)) + trueRanges[i]) / period;
      }
    }

    return result;
  }

  /**
   * Calculate Volume Weighted Average Price (VWAP)
   * Typically calculated intraday, resets each period
   * @param typicalPrice Array of typical prices ((high + low + close)/3)
   * @param volume Array of volume values
   * @returns Array of VWAP values
   */
  static vwap(typicalPrice: number[], volume: number[]): number[] {
    if (typicalPrice.length !== volume.length) {
      return Array(typicalPrice.length).fill(NaN);
    }

    const result: number[] = Array(typicalPrice.length).fill(NaN);
    let cumulativeTPV = 0;
    let cumulativeVolume = 0;

    for (let i = 0; i < typicalPrice.length; i++) {
      cumulativeTPV += typicalPrice[i] * volume[i];
      cumulativeVolume += volume[i];

      if (cumulativeVolume > 0) {
        result[i] = cumulativeTPV / cumulativeVolume;
      }
    }

    return result;
  }

  /**
   * Calculate Average Directional Index (ADX)
   * Measures trend strength regardless of direction
   * @param high Array of high prices
   * @param low Array of low prices
   * @param close Array of closing prices
   * @param period Number of periods (default: 14)
   * @returns Object containing ADX, +DI, and -DI values
   */
  static adx(
    high: number[],
    low: number[],
    close: number[],
    period: number = 14
  ): {
    adx: number[];
    plusDI: number[];
    minusDI: number[];
  } {
    if (period <= 0 || high.length < period + 1) {
      const empty = Array(high.length).fill(NaN);
      return { adx: [...empty], plusDI: [...empty], minusDI: [...empty] };
    }

    // Calculate True Range (TR)
    const tr: number[] = Array(high.length).fill(0);
    for (let i = 0; i < high.length; i++) {
      const highLow = high[i] - low[i];
      const highClosePrev = Math.abs(high[i] - (i > 0 ? close[i - 1] : close[i]));
      const lowClosePrev = Math.abs(low[i] - (i > 0 ? close[i - 1] : close[i]));
      tr[i] = Math.max(highLow, highClosePrev, lowClosePrev);
    }

    // Calculate Directional Movement (+DM and -DM)
    const plusDM: number[] = Array(high.length).fill(0);
    const minusDM: number[] = Array(high.length).fill(0);

    for (let i = 1; i < high.length; i++) {
      const upMove = high[i] - high[i - 1];
      const downMove = low[i - 1] - low[i];

      if (upMove > downMove && upMove > 0) {
        plusDM[i] = upMove;
      } else {
        plusDM[i] = 0;
      }

      if (downMove > upMove && downMove > 0) {
        minusDM[i] = downMove;
      } else {
        minusDM[i] = 0;
      }
    }

    // Smoothed values using Wilder's smoothing
    const smoothedTR: number[] = this.wilderSmooth(tr, period);
    const smoothedPlusDM: number[] = this.wilderSmooth(plusDM, period);
    const smoothedMinusDM: number[] = this.wilderSmooth(minusDM, period);

    // Calculate Directional Indicators (+DI and -DI)
    const plusDI: number[] = Array(high.length).fill(NaN);
    const minusDI: number[] = Array(high.length).fill(NaN);
    const dx: number[] = Array(high.length).fill(NaN); // Directional Index

    for (let i = 0; i < high.length; i++) {
      if (!isNaN(smoothedTR[i]) && smoothedTR[i] !== 0) {
        plusDI[i] = (smoothedPlusDM[i] / smoothedTR[i]) * 100;
        minusDI[i] = (smoothedMinusDM[i] / smoothedTR[i]) * 100;

        const diff = Math.abs(plusDI[i] - minusDI[i]);
        const sum = plusDI[i] + minusDI[i];
        dx[i] = sum !== 0 ? (diff / sum) * 100 : 0;
      }
    }

    // Calculate ADX (smoothed DX)
    const adx = this.wilderSmooth(dx, period);

    return { adx, plusDI, minusDI };
  }

  /**
   * Wilder's smoothing (same as used in RSI and ATR calculations)
   * @param data Array of values to smooth
   * @param period Smoothing period
   * @returns Smoothed array
   */
  private static wilderSmooth(data: number[], period: number): number[] {
    if (period <= 0 || data.length < period) {
      return Array(data.length).fill(NaN);
    }

    const result: number[] = Array(data.length).fill(NaN);

    // First value is the average of first 'period' values
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += data[i];
    }
    result[period - 1] = sum / period;

    // Subsequent values using Wilder's smoothing
    for (let i = period; i < data.length; i++) {
      result[i] = ((result[i - 1] * (period - 1)) + data[i]) / period;
    }

    return result;
  }

  /**
   * Calculate Stochastic Oscillator
   * @param high Array of high prices
   * @param low Array of low prices
   * @param close Array of closing prices
   * @param kPeriod Period for %K (default: 14)
   * @param dPeriod Period for %D (default: 3)
   * @returns Object containing %K and %D values
   */
  static stoch(
    high: number[],
    low: number[],
    close: number[],
    kPeriod: number = 14,
    dPeriod: number = 3
  ): {
    k: number[];
    d: number[];
  } {
    if (kPeriod <= 0 || dPeriod <= 0 || high.length < kPeriod) {
      const empty = Array(high.length).fill(NaN);
      return { k: [...empty], d: [...empty] };
    }

    const k: number[] = Array(high.length).fill(NaN);

    // Calculate %K
    for (let i = kPeriod - 1; i < high.length; i++) {
      const highestHigh = Math.max(...high.slice(i - kPeriod + 1, i + 1));
      const lowestLow = Math.min(...low.slice(i - kPeriod + 1, i + 1));

      if (highestHigh === lowestLow) {
        k[i] = 50; // Avoid division by zero
      } else {
        k[i] = ((close[i] - lowestLow) / (highestHigh - lowestLow)) * 100;
      }
    }

    // Calculate %D (SMA of %K)
    const d = this.sma(k, dPeriod);

    return { k, d };
  }

  /**
   * Calculate Williams %R
   * @param high Array of high prices
   * @param low Array of low prices
   * @param close Array of closing prices
   * @param period Lookback period (default: 14)
   * @returns Array of Williams %R values
   */
  static williamsR(
    high: number[],
    low: number[],
    close: number[],
    period: number = 14
  ): number[] {
    if (period <= 0 || high.length < period) {
      return Array(high.length).fill(NaN);
    }

    const result: number[] = Array(high.length).fill(NaN);

    for (let i = period - 1; i < high.length; i++) {
      const highestHigh = Math.max(...high.slice(i - period + 1, i + 1));
      const lowestLow = Math.min(...low.slice(i - period + 1, i + 1));

      if (highestHigh === lowestLow) {
        result[i] = -50; // Avoid division by zero
      } else {
        result[i] = ((highestHigh - close[i]) / (highestHigh - lowestLow)) * -100;
      }
    }

    return result;
  }

  /**
   * Calculate Commodity Channel Index (CCI)
   * @param high Array of high prices
   * @param low Array of low prices
   * @param close Array of closing prices
   * @param period Lookback period (default: 20)
   * @param constant Scaling constant (default: 0.015)
   * @returns Array of CCI values
   */
  static cci(
    high: number[],
    low: number[],
    close: number[],
    period: number = 20,
    constant: number = 0.015
  ): number[] {
    if (period <= 0 || high.length < period) {
      return Array(high.length).fill(NaN);
    }

    const typicalPrice = high.map((h, i) => (h + low[i] + close[i]) / 3);
    const smaTP = this.sma(typicalPrice, period);
    const meanDeviation: number[] = Array(high.length).fill(0);
    const result: number[] = Array(high.length).fill(NaN);

    // Calculate mean deviation
    for (let i = period - 1; i < high.length; i++) {
      const tpSlice = typicalPrice.slice(i - period + 1, i + 1);
      const sma = smaTP[i];

      if (isNaN(sma)) continue;

      let sum = 0;
      for (let j = 0; j < tpSlice.length; j++) {
        sum += Math.abs(tpSlice[j] - sma);
      }
      meanDeviation[i] = sum / tpSlice.length;
    }

    // Calculate CCI
    for (let i = period - 1; i < high.length; i++) {
      if (meanDeviation[i] !== 0 && !isNaN(smaTP[i]) && !isNaN(meanDeviation[i])) {
        result[i] = (typicalPrice[i] - smaTP[i]) / (constant * meanDeviation[i]);
      }
    }

    return result;
  }

  /**
   * Calculate On-Balance Volume (OBV)
   * @param close Array of closing prices
   * @param volume Array of volume values
   * @returns Array of OBV values
   */
  static obv(close: number[], volume: number[]): number[] {
    if (close.length !== volume.length) {
      return Array(close.length).fill(NaN);
    }

    const result: number[] = Array(close.length).fill(0);

    for (let i = 1; i < close.length; i++) {
      if (close[i] > close[i - 1]) {
        result[i] = result[i - 1] + volume[i];
      } else if (close[i] < close[i - 1]) {
        result[i] = result[i - 1] - volume[i];
      } else {
        result[i] = result[i - 1];
      }
    }

    return result;
  }

  /**
   * Calculate Money Flow Index (MFI)
   * @param high Array of high prices
   * @param low Array of low prices
   * @param close Array of closing prices
   * @param volume Array of volume values
   * @param period Lookback period (default: 14)
   * @returns Array of MFI values (0-100)
   */
  static mfi(
    high: number[],
    low: number[],
    close: number[],
    volume: number[],
    period: number = 14
  ): number[] {
    if (period <= 0 || high.length < period || low.length < period || close.length < period || volume.length < period) {
      return Array(high.length).fill(NaN);
    }

    const typicalPrice = high.map((h, i) => (h + low[i] + close[i]) / 3);
    const moneyFlow = typicalPrice.map((tp, i) => tp * volume[i]);
    const positiveFlow: number[] = Array(high.length).fill(0);
    const negativeFlow: number[] = Array(high.length).fill(0);
    const result: number[] = Array(high.length).fill(NaN);

    // Calculate positive and negative money flow
    for (let i = 1; i < typicalPrice.length; i++) {
      if (typicalPrice[i] > typicalPrice[i - 1]) {
        positiveFlow[i] = moneyFlow[i];
      } else if (typicalPrice[i] < typicalPrice[i - 1]) {
        negativeFlow[i] = moneyFlow[i];
      }
    }

    // Calculate MFI
    for (let i = period; i < high.length; i++) {
      let posSum = 0;
      let negSum = 0;

      for (let j = 0; j < period; j++) {
        posSum += positiveFlow[i - j];
        negSum += negativeFlow[i - j];
      }

      if (negSum === 0) {
        result[i] = 100;
      } else {
        const moneyRatio = posSum / negSum;
        result[i] = 100 - (100 / (1 + moneyRatio));
      }
    }

    return result;
  }
}