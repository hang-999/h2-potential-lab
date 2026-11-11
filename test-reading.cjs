const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, 'reading');
const scripts = html => [...html.matchAll(/<script\b[^>]*\bsrc=['"]([^'"]+)['"][^>]*>/gi)].map(match => match[1]);
const figureCount = html => [...html.matchAll(/<figure\b/gi)].length;
const ids = html => [...html.matchAll(/\bid=['"]([^'"]+)['"]/g)].map(match => match[1]);
const citations = html => [...html.matchAll(/<d-cite\b[^>]*key=['"]([^'"]+)['"]/g)].map(match => match[1]).sort();

function assertResources(html, directory) {
  for (const match of html.matchAll(/<(?:script|img|link)\b[^>]*?\b(?:src|href)=['"]([^'"]+)['"]/gi)) {
    const source = match[1];
    if (/^(?:[a-z]+:|\/\/)/i.test(source)) continue;
    const file = path.resolve(directory, source.split(/[?#]/, 1)[0]);
    assert.ok(fs.existsSync(file), 'Missing article resource ' + source);
  }
}

for (const article of ['gnn', 'pair/fill-in-the-blank']) {
  const directory = path.join(root, article);
  const english = fs.readFileSync(path.join(directory, 'index.html'), 'utf8');
  const chinese = fs.readFileSync(path.join(directory, 'zh.html'), 'utf8');
  assert.match(chinese, /<html lang="zh-CN">/);
  assert.deepEqual(scripts(chinese), scripts(english), 'Both editions use the same runtime scripts');
  assert.deepEqual(ids(chinese), ids(english), 'Article anchors and graph mounts retain their IDs');
  assert.equal(figureCount(chinese), figureCount(english));
  assert.deepEqual(citations(chinese), citations(english), 'Preserve all original citation keys');
  assertResources(english, directory);
  assertResources(chinese, directory);
  if (article.startsWith('pair')) {
    const mounts = html => [...html.matchAll(/<div class=['"]((?:sent |hamlet-edit|pair |gender-over-time|difference-difference)[^'"]*)['"]/g)]
      .map(match => match[1]);
    assert.deepEqual(mounts(chinese), mounts(english), 'Retain PAIR figure mount points in order');
    assert.equal(mounts(english).length, 12);
    const data = path.join(directory, 'data');
    const globals = {window:{}};
    vm.runInNewContext(fs.readFileSync(path.join(data,'cachekey2filename.js'),'utf8'), globals);
    const cache = Object.entries(globals.window.cacheKey2filename);
    assert.equal(cache.length, 29);
    for (const [key, file] of cache) {
      const values = JSON.parse(fs.readFileSync(path.join(data,file),'utf8'));
      if (key.endsWith('embed_group_top')) {
        assert.ok(values.every(group => group.length === 90));
      } else {
        assert.equal(values.length, 30522);
        assert.ok(values.every(Number.isFinite));
      }
    }
  }
}
console.log('Reading editions preserve the article assets, citation keys and visualization mounts.');
