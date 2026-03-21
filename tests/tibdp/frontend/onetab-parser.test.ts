import { describe, it, expect } from 'vitest';
import { parseOneTabText } from '../../../frontend/src/lib/onetab-parser';

describe('parseOneTabText', () => {
  it('should parse a single line with URL and title', () => {
    const result = parseOneTabText('https://spark-f18.tsmc.com | Spark F18');
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://spark-f18.tsmc.com');
    expect(result[0].title).toBe('Spark F18');
  });

  it('should parse multiple lines', () => {
    const input = `https://spark-f18.tsmc.com | Spark F18
https://airflow-f12.tsmc.com | Airflow F12
https://grafana-f22.tsmc.com | Grafana F22`;

    const result = parseOneTabText(input);
    expect(result).toHaveLength(3);
    expect(result[0].url).toBe('https://spark-f18.tsmc.com');
    expect(result[1].url).toBe('https://airflow-f12.tsmc.com');
    expect(result[2].url).toBe('https://grafana-f22.tsmc.com');
  });

  it('should extract title from hostname when no title provided', () => {
    const result = parseOneTabText('https://spark-f18.tsmc.com');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('spark-f18.tsmc.com');
  });

  it('should auto-detect factory tags from URL', () => {
    const result = parseOneTabText('https://spark-f18.tsmc.com | Spark');
    expect(result[0].tags).toContain('f18');
  });

  it('should detect multiple factory tags in a URL', () => {
    // URL containing multiple factory identifiers
    const result = parseOneTabText('https://compare-f18-f12.tsmc.com | Compare');
    expect(result[0].tags).toContain('f18');
    expect(result[0].tags).toContain('f12');
  });

  it('should auto-detect category from URL keywords', () => {
    expect(parseOneTabText('https://spark-f18.tsmc.com | S')[0].category).toBe('Spark');
    expect(parseOneTabText('https://airflow-f12.tsmc.com | A')[0].category).toBe('Airflow');
    expect(parseOneTabText('https://grafana-f22.tsmc.com | G')[0].category).toBe('Monitoring');
    expect(parseOneTabText('https://kibana-f16.tsmc.com | K')[0].category).toBe('Monitoring');
    expect(parseOneTabText('https://jenkins-f20.tsmc.com | J')[0].category).toBe('CI/CD');
    expect(parseOneTabText('https://jupyter-f21.tsmc.com | N')[0].category).toBe('Notebook');
  });

  it('should assign Uncategorized when no keyword matches', () => {
    const result = parseOneTabText('https://custom-tool.tsmc.com | Custom');
    expect(result[0].category).toBe('Uncategorized');
  });

  it('should skip empty lines', () => {
    const input = `https://spark-f18.tsmc.com | Spark

https://airflow-f12.tsmc.com | Airflow

`;
    const result = parseOneTabText(input);
    expect(result).toHaveLength(2);
  });

  it('should handle whitespace around URLs and titles', () => {
    const result = parseOneTabText('  https://spark-f18.tsmc.com  |  Spark F18  ');
    expect(result[0].url).toBe('https://spark-f18.tsmc.com');
    expect(result[0].title).toBe('Spark F18');
  });

  it('should return empty array for empty input', () => {
    expect(parseOneTabText('')).toHaveLength(0);
    expect(parseOneTabText('   ')).toHaveLength(0);
  });

  it('should handle URLs without factory tags', () => {
    const result = parseOneTabText('https://docs.google.com | Google Docs');
    expect(result[0].tags).toHaveLength(0);
  });

  it('should recognize valid factory tags only (not random fNN patterns)', () => {
    // f99 is not a valid factory tag
    const result = parseOneTabText('https://tool-f99.example.com | Tool');
    expect(result[0].tags).not.toContain('f99');
  });

  it('should recognize factory tags with letter suffixes', () => {
    const result = parseOneTabText('https://spark-f14a.tsmc.com | Spark F14A');
    expect(result[0].tags).toContain('f14a');
  });
});
