const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, 'reading');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const write = (file, value) => fs.writeFileSync(path.join(root, file), value);

function chineseEdition(html, title) {
  return html
    .replace(/<html(?: lang="[^"]*")?>/i, '<html lang="zh-CN">')
    .replace(/<title>[^<]*<\/title>/gi, () => `<title>${title}</title>`)
    .replace('aria-label="Article editions"', 'aria-label="阅读版本"')
    .replace('<span aria-current="page" lang="en">English</span>', '<a href="index.html" lang="en">English</a>')
    .replace('<a href="zh.html" lang="zh-CN">中文</a>', '<span aria-current="page">中文</span>')
    .replace('Original publication ↗', '作者原站 ↗')
    .replace('Source &amp; license ↗', '源码与许可 ↗');
}

const pairFolder = 'pair/fill-in-the-blank/';
const pairEnglish = read(pairFolder + 'index.html');
const pairChinese = chineseEdition(pairEnglish, '语言模型学到了什么？')
  .replace(/<h1 class='headline'>[\s\S]+?(?=<link rel="stylesheet" href="style\.css">)/,
    () => read('../reading-src/pair-zh.html') + '\n');
write(pairFolder + 'zh.html', pairChinese);

// Preserve the published graph components, element IDs, and citation markup.
// A translation line corresponds to one prose block of the English edition.
const gnnEnglish = read('gnn/index.html');
const article = /(<d-article\b[^>]*>)([\s\S]+?)(<\/d-article>)/;
const blocks = /(<(?:h[1-4]|p|figcaption|aside)\b[^>]*>)((?:(?!<\/?(?:h[1-4]|p|figcaption|aside)\b)[\s\S])*?)(<\/(?:h[1-4]|p|figcaption|aside)>)/gi;
const readable = html => html.replace(/<[^>]*>/g, '').trim().length > 0;
const gnnBlocks = [...gnnEnglish.match(article)[2].matchAll(blocks)].filter(match => readable(match[2]));

if (process.argv.includes('--list-gnn')) {
  const output = gnnBlocks.map((match, index) => `${index}\t${match[2].replace(/\s+/g, ' ').trim()}`);
  process.stdout.write(output.join('\n'));
} else {
  const translationFile = path.join(__dirname, 'reading-src', 'gnn-zh.txt');
  const translation = fs.readFileSync(translationFile, 'utf8').trimEnd().split(/\r?\n/);
  if (translation.length !== gnnBlocks.length) {
    throw new Error(`GNN translation has ${translation.length} blocks; expected ${gnnBlocks.length}`);
  }
  const title = '图神经网络入门';
  const subtitle = '神经网络可以利用图的结构与属性。本文逐步介绍构建图神经网络所需的组件，并解释背后的设计选择。';
  let index = 0;
  const gnnChinese = chineseEdition(gnnEnglish, title)
    .replace('"title": "A Gentle Introduction to Graph Neural Networks"', () => '"title": ' + JSON.stringify(title))
    .replace(/"description": "What components are needed[^"]+"/, () => '"description": ' + JSON.stringify(subtitle))
    .replace(/(<d-title>\s*<h1>)[^<]*(<\/h1>\s*<p>)[^<]*(<\/p>)/, (_, h, p, end) => h + title + p + subtitle + end)
    .replace('Hover over a node in the diagram below to see how it accumulates information from nodes around it through the layers of the network.', '将指针移到图中的节点上，观察它怎样逐层汇集周围节点的信息。')
    .replace('<h3>Authors</h3>', '<h3>作者</h3>')
    .replace('<h3>Affiliations</h3>', '<h3>机构</h3>')
    .replace('<h3>Published</h3>', '<h3>发表日期</h3>')
    .replace('Sept. 2, 2021', '2021 年 9 月 2 日')
    .replace(article, (_, open, body, close) =>
      open + '<p class="reading-translation-note">译自 Distill。正文和图注已译为中文，图形和交互沿用作者发布的实现。原文及其原创图示采用 <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>。</p>' +
      body.replace(blocks, (original, start, text, end) =>
        readable(text) ? start + translation[index++] + end : original) + close)
    .replace(/(<d-appendix>)[\s\S]+?(?=<d-citation-list)/, '$1\n' + read('../reading-src/gnn-appendix-zh.html'));
  write('gnn/zh.html', gnnChinese);
}
