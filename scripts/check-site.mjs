// Dependency-free checks for the two static Pages documents. Does not fetch URLs.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const site = resolve(root, 'site');
const release = process.argv.includes('--release');
const errors = [];
const base = 'https://ttsbard.github.io/';
const appRootArg = process.argv.indexOf('--app-root');
if (appRootArg !== -1 && (!process.argv[appRootArg + 1] || process.argv[appRootArg + 1].startsWith('--'))) {
  throw new Error('--app-root requires a path to the TTSBard application checkout');
}
const appRoot = appRootArg === -1 ? null : resolve(process.argv[appRootArg + 1]);
if (appRoot && !existsSync(resolve(appRoot, 'docs/en/user/guide.md'))) {
  throw new Error('--app-root must point to the TTSBard application checkout');
}
const locales = { en: 'index.html', ru: 'ru/index.html' };
const shots = ['editor', 'compact', 'mono'];
const sections = ['features', 'voices', 'streaming', 'soundpad', 'sources', 'start', 'faq'];
const fail = (file, message) => errors.push(`${file}: ${message}`);
const attr = (tag, name) => tag.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'))?.[2];
const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map(m => m[0]);
const content = file => readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
const metadata = (html, key) => tags(html, 'meta').find(t => attr(t, 'name') === key || attr(t, 'property') === key);

for (const [lang, file] of Object.entries(locales)) {
  const path = resolve(site, file);
  if (!existsSync(path)) { fail(file, 'page missing'); continue; }
  const html = content(path);
  const pageUrl = base + (lang === 'en' ? '' : 'ru/');
  if (attr(tags(html, 'html')[0] ?? '', 'lang') !== lang) fail(file, 'incorrect document language');
  if ((html.match(/<h1\b/gi) ?? []).length !== 1) fail(file, 'expected one h1');
  if (!/<title>[^<]+<\/title>/i.test(html)) fail(file, 'title missing');
  if (!attr(metadata(html, 'description') ?? '', 'content')) fail(file, 'description missing');
  for (const key of ['og:title', 'og:description', 'og:type', 'og:locale']) {
    if (!attr(metadata(html, key) ?? '', 'content')) fail(file, `${key} missing`);
  }
  if (attr(metadata(html, 'og:url') ?? '', 'content') !== pageUrl) fail(file, 'incorrect OG URL');
  const links = tags(html, 'link');
  const canonical = links.filter(t => attr(t, 'rel') === 'canonical');
  if (canonical.length !== 1 || attr(canonical[0], 'href') !== pageUrl) fail(file, 'incorrect canonical');
  for (const [locale, suffix] of [['en', ''], ['ru', 'ru/'], ['x-default', '']]) {
    const alts = links.filter(t => attr(t, 'rel') === 'alternate' && attr(t, 'hreflang') === locale);
    if (alts.length !== 1 || attr(alts[0], 'href') !== base + suffix) fail(file, `incorrect ${locale} alternate`);
  }
  const ids = [...html.matchAll(/\bid\s*=\s*(["'])(.*?)\1/gi)].map(m => m[2]);
  if (new Set(ids).size !== ids.length) fail(file, 'duplicate element IDs');
  for (const id of ['main', ...sections]) if (!ids.includes(id)) fail(file, `section #${id} missing`);
  for (const tag of [...tags(html, 'a'), ...links, ...tags(html, 'img'), ...tags(html, 'script')]) {
    const url = attr(tag, 'href') ?? attr(tag, 'src');
    if (url === undefined) continue;
    if (/^https:\/\//.test(url)) {
      // Optionally verify application documentation using a separate checkout.
      const doc = url.match(/^https:\/\/github\.com\/ttsbard\/TTSBard\/(?:blob\/master|raw\/refs\/heads\/master)\/(.+?)(?:#.*)?$/);
      if (appRoot && doc && !existsSync(resolve(appRoot, decodeURIComponent(doc[1])))) fail(file, `repository link missing: ${url}`);
      continue;
    }
    if (/^(mailto:|tel:)/.test(url)) continue;
    if (/^(?:[a-z][\w+.-]*:|\/\/)/i.test(url)) { fail(file, `unsupported URL: ${url}`); continue; }
    const parsed = new URL(url, base + (lang === 'en' ? '' : 'ru/'));
    let target = resolve(site, decodeURIComponent(parsed.pathname.slice(1)));
    const rel = relative(site, target);
    if (rel === '..' || rel.startsWith(`..${sep}`)) { fail(file, `URL escapes site: ${url}`); continue; }
    if (existsSync(target) && statSync(target).isDirectory()) target = resolve(target, 'index.html');
    if (!existsSync(target)) { fail(file, `local target missing: ${url}`); continue; }
    if (parsed.hash && target.endsWith('.html')) {
      const targetHtml = content(target);
      const targetId = decodeURIComponent(parsed.hash.slice(1));
      if (![...targetHtml.matchAll(/\bid\s*=\s*(["'])(.*?)\1/gi)].some(m => m[2] === targetId)) fail(file, `anchor missing: ${url}`);
    }
  }
  const images = tags(html, 'img');
  for (const image of images) {
    if (attr(image, 'alt') === undefined) fail(file, 'image alt missing');
    if (!/^\d+$/.test(attr(image, 'width') ?? '') || !/^\d+$/.test(attr(image, 'height') ?? '')) fail(file, 'image dimensions missing');
  }
  for (const role of shots) {
    const placeholders = [...html.matchAll(/\bdata-screenshot-slot\s*=\s*(["'])(.*?)\1/gi)].filter(m => m[2] === role);
    const real = images.filter(t => attr(t, 'data-product-shot') === role);
    if (placeholders.length + real.length !== 1) fail(file, `expected one screenshot role: ${role}`);
    if (release && real.length !== 1) fail(file, `release requires real screenshot: ${role}`);
    for (const image of real) {
      if (!attr(image, 'alt')?.trim()) fail(file, `${role} requires descriptive alt`);
      const captureFolder = role === 'editor' ? lang : 'shared';
      if (!(attr(image, 'src') ?? '').includes(`assets/captures/${captureFolder}/`)) fail(file, `${role} requires a ${captureFolder} capture`);
    }
  }
  if (release && /noindex/i.test(attr(metadata(html, 'robots') ?? '', 'content') ?? '')) fail(file, 'release blocked by noindex');
  if (release && /data-screenshot-slot/i.test(html)) fail(file, 'release contains screenshot placeholders');
}

const sitemap = resolve(site, 'sitemap.xml');
if (!existsSync(sitemap)) fail('sitemap.xml', 'missing');
else {
  const urls = [...readFileSync(sitemap, 'utf8').matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);
  if (urls.length !== 2 || ![base, base + 'ru/'].every(url => urls.includes(url))) fail('sitemap.xml', 'expected exactly the two canonical URLs');
}
if (!existsSync(resolve(site, '.nojekyll'))) fail('.nojekyll', 'missing');
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Landing ${release ? 'release' : 'structure'} checks passed (EN/RU, links, metadata, image roles, sitemap).`);
}
