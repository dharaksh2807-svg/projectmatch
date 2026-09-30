import { describe, it, expect } from 'vitest';
import { buildContextString, CompressedMetadata } from './index';

describe('buildContextString', () => {
  it('compresses metadata efficiently into a string', () => {
    const data: Record<string, CompressedMetadata> = {
      leetcode: {
        rank: '1000',
        solved: 100,
        syncedAt: '2023-01-01T00:00:00Z',
      },
    };
    const result = buildContextString(data);
    expect(result).toBe('UserCtx:LE[solved=100,rank=1000]');
  });

  it('handles empty data gracefully', () => {
    expect(buildContextString({})).toBe('');
  });
});
