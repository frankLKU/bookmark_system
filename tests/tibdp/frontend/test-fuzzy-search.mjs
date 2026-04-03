import { readFileSync } from 'fs';
import { strict as assert } from 'assert';
import { test } from 'node:test';

// Load the IIFE — use new Function to get the return value since const is
// block-scoped inside eval and would not be accessible in module scope.
const code = readFileSync(new URL('../../../frontend/js/utils/fuzzy-search.js', import.meta.url), 'utf-8');
const FuzzySearch = new Function(`${code}; return FuzzySearch;`)();

test('exact match scores highest', () => {
    const result = FuzzySearch.match('spark', 'Spark F18');
    assert.ok(result.match);
    assert.ok(result.score > 0);
});

test('no match returns false', () => {
    const result = FuzzySearch.match('xyz', 'Spark');
    assert.ok(!result.match);
});

test('fuzzy match in order', () => {
    const result = FuzzySearch.match('sf18', 'Spark F18');
    assert.ok(result.match);
});

test('empty query matches everything', () => {
    const result = FuzzySearch.match('', 'anything');
    assert.ok(result.match);
});

test('filter returns sorted results', () => {
    const items = [
        { title: 'Airflow F18', url: 'https://airflow.com' },
        { title: 'Spark F18', url: 'https://spark.com' },
        { title: 'Grafana', url: 'https://grafana.com' },
    ];
    const results = FuzzySearch.filter('spark', items, ['title', 'url']);
    assert.ok(results.length > 0);
    assert.equal(results[0].title, 'Spark F18');
});

test('filter with empty query returns all', () => {
    const items = [{ title: 'A' }, { title: 'B' }];
    const results = FuzzySearch.filter('', items, ['title']);
    assert.equal(results.length, 2);
});
