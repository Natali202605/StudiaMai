import { execSync } from 'child_process';

const SITE = 'https://natali202605.github.io/StudiaMai/';
const SITEMAP = `${SITE}sitemap.xml`;

const links = [
  {
    title: 'Google Search Console — добавить сайт',
    url: 'https://search.google.com/search-console/welcome'
  },
  {
    title: 'Google Rich Results Test',
    url: `https://search.google.com/test/rich-results?url=${encodeURIComponent(SITE)}`
  },
  {
    title: 'Яндекс.Вебмастер — добавить сайт',
    url: 'https://webmaster.yandex.ru/site/indexing/add/'
  },
  {
    title: 'Яндекс.Бизнес — карточка организации',
    url: 'https://yandex.ru/sprav/companies/'
  },
  {
    title: 'Яндекс.Карты — точка на карте',
    url: 'https://yandex.ru/maps/?ll=55.941012%2C58.003946&z=17&pt=55.941012%2C58.003946%2Cpm2rdm'
  },
  {
    title: 'Sitemap сайта',
    url: SITEMAP
  }
];

console.log('Открываю страницы регистрации SEO...\n');
console.log(`Сайт: ${SITE}`);
console.log(`Sitemap: ${SITEMAP}\n`);

for (const { title, url } of links) {
  console.log(`→ ${title}`);
  console.log(`  ${url}`);
  try {
    if (process.platform === 'win32') {
      execSync(`start "" "${url}"`, { stdio: 'ignore', shell: true });
    } else if (process.platform === 'darwin') {
      execSync(`open "${url}"`, { stdio: 'ignore' });
    } else {
      execSync(`xdg-open "${url}"`, { stdio: 'ignore' });
    }
  } catch {
    console.log('  (не удалось открыть автоматически — скопируйте ссылку)');
  }
}

console.log('\n--- Данные для карточки в Яндекс.Бизнес / Картах ---');
console.log('Название: Студия красоты «Май»');
console.log('Адрес: г. Пермь, ул. Ласьвинская, 32');
console.log('Уточнение: Вход с крыльца РЕНО, 2-й этаж');
console.log('Телефон: +7 902 473-78-00');
console.log('Сайт: https://natali202605.github.io/StudiaMai/');
console.log('ВКонтакте: https://vk.com/id838426893');
console.log('Запись: https://mst.link/bolotova_galina');
console.log('Координаты: 58.003946, 55.941012');
console.log('Часы: пн 11:00–20:00 · вт 10:00–20:00 · ср 12:00–20:00 · чт выходной · пт 12:00–20:00 · сб 15:00–20:00 · вс выходной');
console.log('\n--- После верификации ---');
console.log('Google: Индексирование → Файлы Sitemap → добавить URL sitemap');
console.log('Яндекс: Индексирование → Файлы Sitemap → добавить sitemap.xml');
