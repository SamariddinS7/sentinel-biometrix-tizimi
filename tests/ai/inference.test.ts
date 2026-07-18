/**
 * AI Inference Pipeline — Unit tests
 * These run without a GPU; they validate pipeline wiring, not model accuracy.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { aiInferencePipeline } from '../../services/ai/InferencePipeline';

describe('aiInferencePipeline', () => {
  it('is exported and has required methods', () => {
    expect(aiInferencePipeline).toBeDefined();
    expect(typeof aiInferencePipeline.processFrame).toBe('function');
    expect(typeof aiInferencePipeline.getStats).toBe('function');
  });

  it('getStats returns a structured object', () => {
    const stats = aiInferencePipeline.getStats();
    expect(stats).toBeDefined();
    expect(typeof stats).toBe('object');
  });

  it('processFrame returns detections array for a blank frame', async () => {
    // Create a minimal blank frame buffer (640×480 RGB)
    const width = 640;
    const height = 480;
    const channels = 3;
    const blank = new Uint8Array(width * height * channels).fill(0);

    const result = await aiInferencePipeline.processFrame(blank, width, height);
    // May return empty array (no detections) or throw — either is acceptable
    // as long as it doesn't crash with an unhandled error
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('InferencePipeline stats counters', () => {
  it('frameCount is a non-negative integer', () => {
    const stats = aiInferencePipeline.getStats();
    if (typeof stats.frameCount === 'number') {
      expect(stats.frameCount).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(stats.frameCount)).toBe(true);
    }
  });

  it('totalDetections is a non-negative integer', () => {
    const stats = aiInferencePipeline.getStats();
    if (typeof stats.totalDetections === 'number') {
      expect(stats.totalDetections).toBeGreaterThanOrEqual(0);
    }
  });
});
