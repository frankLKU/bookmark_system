import { type FactoryTag, FACTORY_TAGS, type ParsedBookmark } from './types';

const CATEGORY_KEYWORDS: Record<string, string> = {
  spark: 'Spark',
  airflow: 'Airflow',
  grafana: 'Monitoring',
  kibana: 'Monitoring',
  jenkins: 'CI/CD',
  jupyter: 'Notebook',
};

function extractFactoryTags(url: string): FactoryTag[] {
  const matches = url.match(/f\d+[a-z]?/g);
  if (!matches) return [];
  return matches.filter((m): m is FactoryTag =>
    FACTORY_TAGS.includes(m as FactoryTag)
  );
}

function detectCategory(url: string): string {
  const lower = url.toLowerCase();
  for (const [keyword, category] of Object.entries(CATEGORY_KEYWORDS)) {
    if (lower.includes(keyword)) return category;
  }
  return 'Uncategorized';
}

function extractTitle(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function parseOneTabText(text: string): ParsedBookmark[] {
  const lines = text.trim().split('\n').filter(line => line.trim());
  return lines.map(line => {
    const parts = line.split('|').map(s => s.trim());
    const url = parts[0];
    const title = parts[1] || extractTitle(url);
    const tags = extractFactoryTags(url);
    const category = detectCategory(url);
    return { title, url, tags, category };
  });
}
