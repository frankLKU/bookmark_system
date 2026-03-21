export type FactoryTag =
  | 'f12' | 'f14a' | 'f14b' | 'f15a' | 'f15b'
  | 'f16' | 'f18' | 'f18b' | 'f20' | 'f21'
  | 'f22' | 'f23' | 'foc' | 'ftest' | 'ftestdev';

export const FACTORY_TAGS: FactoryTag[] = [
  'f12', 'f14a', 'f14b', 'f15a', 'f15b',
  'f16', 'f18', 'f18b', 'f20', 'f21',
  'f22', 'f23', 'foc', 'ftest', 'ftestdev',
];

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  category: string;
  tags: FactoryTag[];
  isCombined?: boolean;
  lastAccessed: number;
  isHealthy?: boolean | null;
}

export interface TabState {
  id: string;
  type: 'single' | 'split';
  urls: string[];
  titles: string[];
  active: boolean;
}

export interface Category {
  id: string;
  name: string;
  order: number;
}

export interface ParsedBookmark {
  title: string;
  url: string;
  tags: FactoryTag[];
  category: string;
}
