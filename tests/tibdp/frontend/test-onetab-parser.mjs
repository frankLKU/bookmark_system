import { readFileSync } from 'fs';
import { strict as assert } from 'assert';
import { test } from 'node:test';

// Load the IIFE — use new Function to get the return value since const is
// block-scoped inside eval and would not be accessible in module scope.
const code = readFileSync(new URL('../../../frontend/js/utils/onetab-parser.js', import.meta.url), 'utf-8');
const OnetabParser = new Function(`${code}; return OnetabParser;`)();

test('parse basic URL | Title format', () => {
    const result = OnetabParser.parse('https://spark.com | Spark F18');
    assert.equal(result.length, 1);
    assert.equal(result[0].url, 'https://spark.com');
    assert.equal(result[0].title, 'Spark F18');
});

test('parse multiple lines', () => {
    const text = 'https://spark.com | Spark\nhttps://airflow.com | Airflow';
    const result = OnetabParser.parse(text);
    assert.equal(result.length, 2);
});

test('parse URL without title', () => {
    const result = OnetabParser.parse('https://spark.com');
    assert.equal(result.length, 1);
    assert.equal(result[0].url, 'https://spark.com');
    assert.ok(result[0].title.length > 0);
});

test('parse empty string returns empty', () => {
    const result = OnetabParser.parse('');
    assert.equal(result.length, 0);
});

test('parse null returns empty', () => {
    const result = OnetabParser.parse(null);
    assert.equal(result.length, 0);
});

test('skip blank lines', () => {
    const text = 'https://a.com | A\n\n\nhttps://b.com | B';
    const result = OnetabParser.parse(text);
    assert.equal(result.length, 2);
});

test('items have temp_id', () => {
    const result = OnetabParser.parse('https://a.com | A\nhttps://b.com | B');
    assert.equal(result[0].temp_id, 0);
    assert.equal(result[1].temp_id, 1);
});
