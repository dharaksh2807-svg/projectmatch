import { describe, it, expect } from 'vitest';
import { buildContextString, CompressedMetadata } from './index';

describe('buildContextString', () => {
  it('compresses metadata efficiently into a string', () => {
    const data: Record<string, CompressedMetadata> = {
      leetcode: {
        ranking: 1000,
        solved: { total: 100, easy: 50, medium: 40, hard: 10 },
      },
    };
    const result = buildContextString(data);
    expect(result).toContain('leetcode: {"ranking":1000,"solved":{"total":100,"easy":50,"medium":40,"hard":10}}');
  });

  it('handles empty data gracefully', () => {
    expect(buildContextString({})).toBe('');
  });
});
