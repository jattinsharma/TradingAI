/**
 * TradingAI V2 — Multi-Agent Unit Tests
 *
 * Tests core multi-agent foundation classes, enum parsers, base agent helpers,
 * and pipeline orchestration data structures.
 */
import {
  SignalType,
  SignalStrength,
  AgentRole,
  AnalysisDepth,
  LlmProvider,
} from './types/agent.types';
import { BaseAgent, ParsedAgentOutput } from './agents/base-agent';
import { AnalysisContext, AgentConfig } from './types/agent.types';

class MockAgent extends BaseAgent {
  protected getAgentConfig(): AgentConfig {
    return {
      name: 'MockAgent',
      role: AgentRole.TECHNICAL_ANALYST,
      llmProvider: LlmProvider.OLLAMA,
      model: 'mock-model',
      temperature: 0.1,
      maxTokens: 1000,
      systemPrompt: 'Mock system prompt',
      timeoutMs: 5000,
      retryOnFailure: false,
      maxRetries: 0,
    };
  }

  protected buildPrompt(context: AnalysisContext): string {
    return `Analyze ${context.symbol}`;
  }

  protected parseResult(rawResponse: string): ParsedAgentOutput {
    const parsed = this.safeParseJson<{ signal?: string; confidence?: number }>(rawResponse);
    return {
      signal: this.parseSignal(parsed?.signal),
      strength: SignalStrength.STRONG,
      confidence: parsed?.confidence ?? 50,
      reasoning: ['Mock reasoning'],
      data: {},
    };
  }

  // Public wrappers for testing protected methods
  public testParseSignal(sig: string | undefined): SignalType {
    return this.parseSignal(sig);
  }

  public testParseStrength(str: string | undefined): SignalStrength {
    return this.parseStrength(str);
  }

  public testSafeParseJson<T>(raw: string): T | null {
    return this.safeParseJson<T>(raw);
  }

  public testClamp(val: number, min: number, max: number): number {
    return this.clamp(val, min, max);
  }
}

describe('BaseAgent Unit Tests', () => {
  let agent: MockAgent;

  beforeEach(() => {
    // Pass null as LLM provider service since we only test helper methods
    agent = new MockAgent(null as any);
  });

  describe('Signal Parsing', () => {
    it('should parse bullish signals correctly', () => {
      expect(agent.testParseSignal('BULLISH')).toBe(SignalType.BULLISH);
      expect(agent.testParseSignal('BUY')).toBe(SignalType.BULLISH);
      expect(agent.testParseSignal('LONG')).toBe(SignalType.BULLISH);
      expect(agent.testParseSignal('strong bull')).toBe(SignalType.BULLISH);
    });

    it('should parse bearish signals correctly', () => {
      expect(agent.testParseSignal('BEARISH')).toBe(SignalType.BEARISH);
      expect(agent.testParseSignal('SELL')).toBe(SignalType.BEARISH);
      expect(agent.testParseSignal('SHORT')).toBe(SignalType.BEARISH);
      expect(agent.testParseSignal('bearish divergence')).toBe(SignalType.BEARISH);
    });

    it('should default to neutral for undefined or unhandled input', () => {
      expect(agent.testParseSignal(undefined)).toBe(SignalType.NEUTRAL);
      expect(agent.testParseSignal('SIDEWAYS')).toBe(SignalType.NEUTRAL);
      expect(agent.testParseSignal('UNKNOWN')).toBe(SignalType.NEUTRAL);
    });
  });

  describe('Strength Parsing', () => {
    it('should parse signal strength correctly', () => {
      expect(agent.testParseStrength('STRONG')).toBe(SignalStrength.STRONG);
      expect(agent.testParseStrength('HIGH')).toBe(SignalStrength.STRONG);
      expect(agent.testParseStrength('WEAK')).toBe(SignalStrength.WEAK);
      expect(agent.testParseStrength('LOW')).toBe(SignalStrength.WEAK);
      expect(agent.testParseStrength('MODERATE')).toBe(SignalStrength.MODERATE);
      expect(agent.testParseStrength(undefined)).toBe(SignalStrength.MODERATE);
    });
  });

  describe('Safe JSON Parsing', () => {
    it('should parse clean JSON', () => {
      const result = agent.testSafeParseJson<{ key: string }>('{"key": "value"}');
      expect(result).toEqual({ key: 'value' });
    });

    it('should strip markdown code fences', () => {
      const raw = '```json\n{"key": "value"}\n```';
      const result = agent.testSafeParseJson<{ key: string }>(raw);
      expect(result).toEqual({ key: 'value' });
    });

    it('should extract JSON from surrounding text', () => {
      const raw = 'Here is the analysis:\n{"signal": "BULLISH", "confidence": 85}\nHope this helps!';
      const result = agent.testSafeParseJson<{ signal: string; confidence: number }>(raw);
      expect(result).toEqual({ signal: 'BULLISH', confidence: 85 });
    });

    it('should return null for completely unparseable input', () => {
      const result = agent.testSafeParseJson('No JSON here at all');
      expect(result).toBeNull();
    });
  });

  describe('Clamping', () => {
    it('should clamp numbers within bounds', () => {
      expect(agent.testClamp(150, 0, 100)).toBe(100);
      expect(agent.testClamp(-20, 0, 100)).toBe(0);
      expect(agent.testClamp(50, 0, 100)).toBe(50);
    });
  });
});
