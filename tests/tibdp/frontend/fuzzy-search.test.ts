import { describe, it, expect } from 'vitest';
import { fuzzyMatch } from '../../../frontend/src/lib/fuzzy-search';

describe('fuzzyMatch', () => {
  it('should match exact string', () => {
    expect(fuzzyMatch('hello', 'hello')).toBe(true);
  });

  it('should match case-insensitively', () => {
    expect(fuzzyMatch('Hello World', 'hello')).toBe(true);
    expect(fuzzyMatch('SPARK', 'spark')).toBe(true);
  });

  it('should match partial subsequence', () => {
    expect(fuzzyMatch('Spark F18 Dashboard', 'sf18')).toBe(true);
    expect(fuzzyMatch('Spark F18 Dashboard', 'spk')).toBe(true);
  });

  it('should match non-contiguous characters in order', () => {
    expect(fuzzyMatch('abcdef', 'ace')).toBe(true);
    expect(fuzzyMatch('abcdef', 'adf')).toBe(true);
  });

  it('should not match characters out of order', () => {
    expect(fuzzyMatch('abcdef', 'fda')).toBe(false);
    expect(fuzzyMatch('hello', 'oeh')).toBe(false);
  });

  it('should return true for empty query', () => {
    expect(fuzzyMatch('anything', '')).toBe(true);
  });

  it('should return false when query is longer than text', () => {
    expect(fuzzyMatch('hi', 'hello')).toBe(false);
  });

  it('should not match when characters are missing', () => {
    expect(fuzzyMatch('abc', 'abcd')).toBe(false);
    expect(fuzzyMatch('Spark', 'sparkz')).toBe(false);
  });

  it('should match factory tag patterns', () => {
    expect(fuzzyMatch('f18', 'f18')).toBe(true);
    expect(fuzzyMatch('f14a', 'f14')).toBe(true);
    expect(fuzzyMatch('Grafana F22 Monitor', 'gf22')).toBe(true);
  });

  it('should handle special characters gracefully', () => {
    expect(fuzzyMatch('https://spark-f18.tsmc.com', 'spark')).toBe(true);
    expect(fuzzyMatch('https://spark-f18.tsmc.com', 'f18')).toBe(true);
  });
});
