/**
 * Premium Overlay for AI Trading Copilot
 * Full trade setup display: entry, SL, TP, R:R, reasoning, risks, animations.
 */

import { ChartOverlay } from './chart-overlay';

export const overlay = new ChartOverlay();

// The ChartOverlay class already handles everything via chrome messaging.
// This file re-exports for module consistency.
console.log('[Overlay] Premium overlay module loaded');
