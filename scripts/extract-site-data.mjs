import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function parsePriceList(ulHtml) {
  const items = [];
  const liRegex = /<li class="price-list__subtitle">([\s\S]*?)<\/li>|<li class="price-item">([\s\S]*?)<\/li>/g;
  let m;
  while ((m = liRegex.exec(ulHtml)) !== null) {
    if (m[1]) {
      items.push({ type: 'subtitle', text: m[1].trim() });
      continue;
    }
    const block = m[2];
    const name = block.match(/price-item__name">([\s\S]*?)<\/span>/)?.[1]?.trim() || '';
    const price = block.match(/price-item__price[^"]*">([\s\S]*?)<\/span>/)?.[1]?.trim() || '';
    const time = block.match(/price-item__time">([\s\S]*?)<\/span>/)?.[1]?.trim() || '';
    const details = block.match(/price-item__details[\s\S]*?<p>([\s\S]*?)<\/p>/)?.[1]?.trim() || '';
    items.push({ type: 'item', name, price, time, details });
  }
  return items;
}

function extractBetween(html, startMarker, endMarker) {
  const i = html.indexOf(startMarker);
  if (i < 0) return '';
  const j = html.indexOf(endMarker, i);
  return html.slice(i, j);
}

const services = {};

const serviceBlocks = [
  ['brows', '<!-- Брови / услуги Броволога -->', '<!-- Косметологические процедуры -->'],
  ['cosmetology', '<!-- Косметологические процедуры -->', '<!-- Массажи лица -->'],
  ['massage', '<!-- Массажи лица -->', '<!-- Лечение и уход за волосами'],
  ['trichology', '<!-- Лечение и уход за волосами', '<!-- Женская депиляция -->'],
  ['depilation', '<!-- Женская депиляция -->', '</div>\n\n      </div>\n\n      <!-- Ритуалы'],
  ['rituals', '<!-- Ритуалы ухода и обертывание -->', '<!-- Что вы получите -->']
];

for (const [key, start, end] of serviceBlocks) {
  const block = extractBetween(html, start, end);
  const titleHtml = block.match(/class="service-card__title"|class="rituals__title"[^>]*>([\s\S]*?)<\/h3>/)?.[1]?.trim()
    || block.match(/rituals__title">([\s\S]*?)<\/h3>/)?.[1]?.trim() || '';
  const descMatch = block.match(/<p class="service-card__desc">([\s\S]*?)<\/p>/);
  const ulMatch = block.match(/<ul class="price-list"[^>]*>([\s\S]*?)<\/ul>/);
  services[key] = {
    title_html: titleHtml.replace(/class="rituals__title"/, '').replace(/^[^>]*>/, '') || titleHtml,
    desc: descMatch ? descMatch[1].trim() : '',
    items: ulMatch ? parsePriceList(ulMatch[1]) : []
  };
  if (key === 'rituals') {
    const t = block.match(/<h3 class="rituals__title">([\s\S]*?)<\/h3>/);
    if (t) services[key].title_html = t[1].trim();
  }
}

// Fix titles extracted with wrong regex for service cards
for (const key of ['brows', 'cosmetology', 'massage', 'trichology', 'depilation']) {
  const block = extractBetween(html, serviceBlocks.find(s => s[0] === key)[1], serviceBlocks.find(s => s[0] === key)[2]);
  const t = block.match(/<h3 class="service-card__title">([\s\S]*?)<\/h3>/);
  if (t) services[key].title_html = t[1].trim();
}

const content = {
  hero_slogan_html: 'Красота, в которой <span class="accent">комфортно</span> оставаться <span class="accent">собой</span>',
  hero_text: 'Брови, ресницы, уход за лицом, депиляция и эстетические процедуры, которые помогают чувствовать себя ухоженно каждый день.',
  hero_subtext: 'Мы не стремимся менять вас до неузнаваемости. Наша задача — подчеркнуть естественную красоту, сохранить гармонию и подобрать уход, который действительно подходит именно вам.',
  hero_stat_rating: '4.9',
  hero_stat_rating_label: 'рейтинг клиентов',
  hero_stat_reviews: '30+',
  hero_stat_reviews_label: 'отзывов клиентов',
  about_eyebrow: 'О студии',
  about_title_html: 'Что можно <span class="accent">решить</span> в «Май»',
  about_checklist: [
    'Восстановить форму перещипанных бровей',
    'Сделать взгляд более открытым и выразительным',
    'Подобрать уход за кожей лица',
    'Улучшить качество кожи без агрессивных процедур',
    'Избавиться от нежелательных волос комфортным способом',
    'Получить понятный план ухода без лишних назначений'
  ],
  audience_eyebrow: 'Аудитория',
  audience_title_html: 'Для кого <span class="accent">наша студия</span>',
  audience_lead: 'Для тех, кто:',
  audience_list: [
    'хочет выглядеть ухоженно естественно',
    'ценит аккуратную работу и внимание к деталям',
    'устал от случайных рекомендаций из интернета',
    'ищет мастера, которому можно доверить свою внешность',
    'предпочитает спокойный и профессиональный подход без давления'
  ],
  consultation_eyebrow: 'Консультация',
  consultation_title_html: 'Как проходит <span class="accent accent--light">первая встреча</span>',
  consultation_quote_html: 'Многие клиенты приходят с вопросом: <em>«Я не понимаю, какая процедура мне нужна».</em> Это нормально. Поэтому мы начинаем не с услуги, а с консультации.',
  consultation_steps_title: 'На консультации мы:',
  consultation_steps: [
    'обсуждаем ваш запрос',
    'оцениваем состояние кожи, бровей или ресниц',
    'объясняем возможные варианты ухода',
    'отвечаем на вопросы',
    'подбираем процедуру только при необходимости'
  ],
  consultation_free_1: 'Консультация косметолога',
  consultation_free_2: 'Консультация по восстановлению бровей',
  master_eyebrow: 'Мастер',
  master_title_html: 'Галина <span class="accent">Болотова</span>',
  master_role: 'Броволог, Brow-мастер, ламинирование ресниц, депиляция',
  master_p1: 'Работа Галины строится на внимательности и уважении к индивидуальности каждого клиента.',
  master_p2: 'Особое направление — восстановление бровей после многолетнего выщипывания, работа со сложным ростом волосков, подбор формы без шаблонов и трендов «для всех».',
  master_highlight: 'В работе важно не просто выполнить процедуру, а помочь человеку почувствовать уверенность в своем отражении.',
  approach_eyebrow: 'Философия',
  approach_title_html: '<span class="accent">Наш</span> подход',
  approach_subtitle_html: 'Никаких <span class="accent">универсальных</span> решений',
  approach_lead: 'Каждый человек приходит со своей историей. Поэтому вместо стандартных схем мы учитываем:',
  approach_card_title_html: 'Мы учитываем <span class="accent">все</span>:',
  approach_grid: ['особенности лица', 'состояние кожи', 'направление роста волосков', 'образ жизни', 'пожелания клиента'],
  approach_principles_title_html: 'Мы всегда <span class="accent">объясняем</span>, что <span class="accent">делаем</span> и <span class="accent">зачем</span>.',
  approach_principles_list_html: [
    'Без сложных <span class="accent">терминов</span>',
    'Без навязанных <span class="accent">процедур</span>',
    'Без <span class="accent">спешки</span>'
  ],
  services_eyebrow: 'Направления',
  services_title_html: '<span class="accent">Услуги</span>',
  services_lead: 'Выберите направление — нажмите «Подробнее» у услуги для полного описания',
  benefits_eyebrow: 'Результат',
  benefits_title_html: 'Что вы <span class="accent">получите</span>',
  benefits_lead: 'После процедур клиенты чаще всего отмечают:',
  benefits_items: [
    'более ухоженный внешний вид',
    'ощущение свежести и легкости',
    'понятную систему домашнего ухода',
    'уверенность в своём отражении',
    'спокойствие от того, что рядом есть специалист, которому можно доверять'
  ],
  faq_eyebrow: 'Вопросы',
  faq_title_html: '<span class="accent">Частые</span> сомнения',
  faq_items: [
    { q: 'Боюсь, что мне начнут навязывать процедуры', a: 'Мы предлагаем только то, что действительно может быть полезно именно в вашем случае.' },
    { q: 'Не знаю, с чего начать', a: 'Для этого существует консультация.' },
    { q: 'Боюсь, что результат будет слишком заметным', a: 'Мы работаем в эстетике естественной красоты и учитываем ваши пожелания.' },
    { q: 'У меня был неудачный опыт', a: 'Именно поэтому мы подробно обсуждаем ожидания до начала работы.' }
  ],
  reviews_eyebrow: 'Доверие',
  reviews_title_html: '<span class="accent">Отзывы</span>',
  reviews_lead: 'Реальные отзывы и результаты наших клиентов',
  format_eyebrow: 'Формат',
  format_title_html: '<span class="accent">Стоимость</span> и формат',
  format_card_1_price: 'Бесплатно',
  format_card_1_text: 'Первая консультация косметолога',
  format_card_2_price: 'Бесплатно',
  format_card_2_text: 'Консультация по восстановлению бровей',
  format_card_3_price: 'По записи',
  format_card_3_text: 'пн 11–20 · вт 10–20 · ср 12–20 · чт выходной · пт 12–20 · сб 15–20 · вс выходной',
  booking_title_html: 'Готовы <span class="accent accent--light">познакомиться?</span>',
  booking_text: 'Если вы давно ищете специалиста, который внимательно выслушает и поможет подобрать подходящий уход — начните с консультации.',
  booking_principles: ['Без обязательств', 'Без давления', 'С уважением к вашим пожеланиям'],
  footer_name: 'Студия красоты «Май»',
  footer_master: 'Галина Болотова',
  footer_spec: 'Депиляция · Brow-мастер · Ламинирование ресниц · Бровология',
  footer_contacts_title: 'Контакты',
  footer_address: 'г. Пермь, ул. Ласьвинская, 32',
  footer_entrance: 'Вход с крыльца РЕНО, 2-й этаж',
  footer_phone: '+7 902 473-78-00',
  footer_phone_label: 'Телефон: +7 902 473-78-00',
  footer_vk: 'ВКонтакте: @id838426893',
  footer_vk_url: 'https://vk.com/id838426893',
  footer_booking_label: 'Онлайн-запись',
  footer_booking_url: 'https://mst.link/bolotova_galina',
  footer_site_label: 'Сайт: natali202605.github.io/StudiaMai',
  footer_site_url: 'https://natali202605.github.io/StudiaMai/',
  footer_hours: 'пн 11:00–20:00 · вт 10:00–20:00 · ср 12:00–20:00 · чт выходной · пт 12:00–20:00 · сб 15:00–20:00 · вс выходной',
  footer_legal_note: 'Правовые документы действуют на территории Российской Федерации.'
};

// Extract reviews from HTML
const reviews = [];
const reviewRegex = /<div class="review-card">([\s\S]*?)<\/div>\s*(?=<div class="review-card">|<\/div>\s*<\/div>\s*<div class="reviews-slider__progress)/g;
let rm;
while ((rm = reviewRegex.exec(html)) !== null) {
  const block = rm[1];
  const text = block.match(/review-card__text">([\s\S]*?)<\/p>/)?.[1]?.trim() || '';
  const author = block.match(/review-card__author">([\s\S]*?)<\/span>/)?.[1]?.trim() || '';
  const stars = (block.match(/★/g) || []).length || 5;
  reviews.push({ text, author, stars });
}
content.reviews = reviews;

fs.writeFileSync(path.join(root, 'data', 'services.json'), JSON.stringify(services, null, 2), 'utf8');
fs.writeFileSync(path.join(root, 'data', 'content.json'), JSON.stringify(content, null, 2), 'utf8');
console.log('services keys:', Object.keys(services).join(', '));
console.log('content keys:', Object.keys(content).length);
console.log('reviews:', reviews.length);
