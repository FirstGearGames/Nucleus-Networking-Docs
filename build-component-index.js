#!/usr/bin/env node
'use strict';
// Writes static/component-docs.json: which page documents each Unity component, so the Unity
// inspectors' help icons follow pages when they move or are renamed. The editor downloads this
// file from the deployed site, so a docs deploy is all it takes to update every link.
//
// A page documents a component when either:
//   - its frontmatter names it:  components: "UnityTransportManager, UnityManager"
//   - its title is the component's name, ignoring spaces, backticks, a trailing "component" and
//     anything after a colon ("NetworkSystemObject component", "Network Interest Object").
// An explicit frontmatter entry wins over a title match, and pages under unity/ win over the rest.
//
// Run on its own with `node build-component-index.js`; build.js runs it before rendering.
const fs = require('fs');
const path = require('path');

const root = __dirname;
const config = JSON.parse(fs.readFileSync(path.join(root, 'docs.config.json'), 'utf8'));
const version = config.defaultVersion;
const versionDir = path.join(root, 'content', version);
const outFile = path.join(root, 'static', 'component-docs.json');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith('_'))
    .flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return entry.name.endsWith('.md') ? [full] : [];
    });
}

function readFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const fields = {};
  if (!match) return fields;
  for (const line of match[1].split(/\r?\n/)) {
    const pair = /^(\w+):\s*"?(.*?)"?\s*$/.exec(line);
    if (pair) fields[pair[1]] = pair[2];
  }
  return fields;
}

function nameFromTitle(title) {
  const words = title.split(':')[0].replace(/`/g, '').replace(/\s+component$/i, '').trim().split(/\s+/);
  // A sentence ("Choose your track") is not a name; every word of a name is capitalized.
  return words.every((word) => /^[A-Z][A-Za-z0-9]*$/.test(word)) ? words.join('') : null;
}

function pageUrl(file) {
  const relative = path.relative(versionDir, file).replace(/\\/g, '/').replace(/\.md$/, '');
  const slug = relative === 'index' ? '' : relative.replace(/\/index$/, '') + '/';
  return `/docs/${version}/${slug}`;
}

// Higher wins: explicit beats title, unity/ beats other sections.
function rank(isExplicit, url) {
  return (isExplicit ? 2 : 0) + (url.includes(`/docs/${version}/unity/`) ? 1 : 0);
}

const best = new Map();
for (const file of walk(versionDir)) {
  const fields = readFrontmatter(fs.readFileSync(file, 'utf8'));
  const url = pageUrl(file);
  const explicit = (fields.components || '').split(',').map((name) => name.trim()).filter(Boolean);
  const candidates = explicit.length ? explicit.map((name) => [name, true]) : [[nameFromTitle(fields.title || ''), false]];
  for (const [name, isExplicit] of candidates) {
    if (!name) continue;
    const score = rank(isExplicit, url);
    const current = best.get(name);
    if (!current || score > current.score) best.set(name, { url, score });
  }
}

const pages = [...best.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([component, { url }]) => ({ component, path: url }));

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify({ version, pages }, null, 2) + '\n');
console.log(`component-docs.json: ${pages.length} components`);
