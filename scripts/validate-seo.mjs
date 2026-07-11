import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const SITE_URL = 'https://natali202605.github.io/StudiaMai/';
const GEO = { lat: 58.003946, lon: 55.941012 };
const PHONE = '+79024737800';
const ADDRESS = {
  street: 'ул. Ласьвинская, 32',
  city: 'Пермь',
  region: 'Пермский край',
  postal: '614101',
  country: 'RU'
};

const errors = [];
const warnings = [];

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function getMeta(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escaped}["']`, 'i'),
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["']`, 'i')
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1];
  }
  return null;
}

function getCanonical(html) {
  const m = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
  return m ? m[1] : null;
}

function getJsonLd(html) {
  const m = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!m) return null;
  try {
    return JSON.parse(m[1].trim());
  } catch (e) {
    fail(`JSON-LD не парсится: ${e.message}`);
    return null;
  }
}

function findBusinessNode(data) {
  const graph = data?.['@graph'] || [data];
  return graph.find((node) => {
    const type = node?.['@type'];
    return Array.isArray(type)
      ? type.includes('LocalBusiness') || type.includes('BeautySalon')
      : type === 'LocalBusiness' || type === 'BeautySalon';
  });
}

function validateIndex() {
  const html = read('index.html');

  const requiredMeta = [
    'description',
    'robots',
    'geo.region',
    'geo.placename',
    'geo.position',
    'ICBM'
  ];

  for (const name of requiredMeta) {
    if (!getMeta(html, name)) fail(`index.html: отсутствует meta name="${name}"`);
  }

  const ogRequired = ['og:title', 'og:description', 'og:type', 'og:url', 'og:locale', 'og:image'];
  for (const name of ogRequired) {
    if (!getMeta(html, name)) fail(`index.html: отсутствует meta property="${name}"`);
  }

  const twitterRequired = ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'];
  for (const name of twitterRequired) {
    if (!getMeta(html, name)) fail(`index.html: отсутствует meta name="${name}"`);
  }

  const canonical = getCanonical(html);
  if (!canonical) fail('index.html: отсутствует canonical');
  else if (canonical !== SITE_URL) fail(`index.html: canonical "${canonical}" не совпадает с ${SITE_URL}`);

  const robots = getMeta(html, 'robots') || '';
  if (!/index/i.test(robots)) fail('index.html: robots должен разрешать индексацию (index)');

  const geoPosition = getMeta(html, 'geo.position');
  if (geoPosition && geoPosition !== `${GEO.lat};${GEO.lon}`) {
    fail(`index.html: geo.position "${geoPosition}" не совпадает с ${GEO.lat};${GEO.lon}`);
  }

  const icbm = getMeta(html, 'geo.position') ? getMeta(html, 'ICBM') : null;
  if (icbm && !icbm.includes(String(GEO.lat)) && !icbm.includes(String(GEO.lon))) {
    warn('index.html: ICBM может быть указан в неверном формате');
  }

  const jsonLd = getJsonLd(html);
  if (!jsonLd) {
    fail('index.html: отсутствует JSON-LD');
    return;
  }

  const business = findBusinessNode(jsonLd);
  if (!business) {
    fail('JSON-LD: нет узла LocalBusiness/BeautySalon');
    return;
  }

  if (!business.name) fail('JSON-LD: отсутствует name');
  if (!business.telephone || business.telephone.replace(/\D/g, '') !== PHONE.replace(/\D/g, '')) {
    fail(`JSON-LD: telephone должен быть ${PHONE}`);
  }

  const addr = business.address || {};
  if (addr.streetAddress !== ADDRESS.street) fail('JSON-LD: неверный streetAddress');
  if (addr.addressLocality !== ADDRESS.city) fail('JSON-LD: неверный addressLocality');
  if (addr.addressRegion !== ADDRESS.region) fail('JSON-LD: неверный addressRegion');
  if (addr.postalCode !== ADDRESS.postal) fail('JSON-LD: неверный postalCode');
  if (addr.addressCountry !== ADDRESS.country) fail('JSON-LD: неверный addressCountry');

  const geo = business.geo || {};
  if (Number(geo.latitude) !== GEO.lat || Number(geo.longitude) !== GEO.lon) {
    fail(`JSON-LD: geo должен быть ${GEO.lat}, ${GEO.lon}`);
  }

  if (!business.hasMap) warn('JSON-LD: рекомендуется добавить hasMap');
  if (!Array.isArray(business.openingHoursSpecification) || !business.openingHoursSpecification.length) {
    fail('JSON-LD: отсутствует openingHoursSpecification');
  }

  if (html.includes('lang="ru"') === false) fail('index.html: отсутствует lang="ru" на <html>');
}

function validateRobots() {
  if (!fs.existsSync(path.join(root, 'robots.txt'))) {
    fail('robots.txt отсутствует');
    return;
  }
  const robots = read('robots.txt');
  if (!/Sitemap:\s*https:\/\/natali202605\.github\.io\/StudiaMai\/sitemap\.xml/i.test(robots)) {
    fail('robots.txt: отсутствует корректная директива Sitemap');
  }
  if (!/Disallow:\s*\/admin\//i.test(robots)) {
    warn('robots.txt: рекомендуется закрыть /admin/ от индексации');
  }
}

function validateSitemap() {
  const file = path.join(root, 'sitemap.xml');
  if (!fs.existsSync(file)) {
    fail('sitemap.xml отсутствует');
    return;
  }
  const xml = read('sitemap.xml');
  if (!xml.includes('<urlset')) fail('sitemap.xml: неверный формат');
  if (!xml.includes(SITE_URL)) fail(`sitemap.xml: нет главной страницы ${SITE_URL}`);
}

validateIndex();
validateRobots();
validateSitemap();

console.log('SEO validation — Студия красоты «Май»\n');

if (warnings.length) {
  console.log('Предупреждения:');
  warnings.forEach((w) => console.log(`  ⚠ ${w}`));
  console.log('');
}

if (errors.length) {
  console.log('Ошибки:');
  errors.forEach((e) => console.log(`  ✗ ${e}`));
  console.log(`\nИтог: ${errors.length} ошибок, ${warnings.length} предупреждений`);
  process.exit(1);
}

console.log(`Итог: все проверки пройдены (${warnings.length} предупреждений)`);
