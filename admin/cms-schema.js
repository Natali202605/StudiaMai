(function () {
  'use strict';

  window.StudiaMaiCmsSchema = {
    SERVICE_META: {
      brows: { title: 'Брови / услуги Броволога', hint: 'Карточка бровей и ресниц' },
      cosmetology: { title: 'Косметологические процедуры', hint: 'Уход, маски, пилинги, мезотерапия' },
      massage: { title: 'Массажи лица', hint: 'Все виды массажа лица' },
      trichology: { title: 'Трихология', hint: 'Лечение и уход за волосами' },
      depilation: { title: 'Женская депиляция', hint: 'Депиляция и комплексы' },
      rituals: { title: 'Ритуалы ухода', hint: 'Блок под карточками услуг' }
    },

    IMAGE_LABELS: {
      logo: 'Логотип',
      hero_logo: 'Логотип в шапке главной',
      brand_title: 'Надпись «Студия Май» (картинка)',
      hero_studio: 'Фото студии на главной',
      service_brows: 'Услуга: брови и ресницы',
      service_cosmetology: 'Услуга: косметология',
      service_massage: 'Услуга: массаж',
      service_trichology: 'Услуга: трихология',
      service_depilation: 'Услуга: депиляция',
      service_rituals: 'Ритуалы ухода',
      master_portrait: 'Портрет мастера',
      master_card: 'Визитка мастера',
      master_certificates: 'Сертификаты'
    },

    CONTENT_GROUPS: [
      {
        id: 'meta',
        title: 'SEO и название сайта',
        fields: [
          { key: 'meta_title', label: 'Заголовок вкладки браузера' },
          { key: 'meta_description', label: 'Описание сайта (meta description)', textarea: true },
          { key: 'brand_city', label: 'Город под логотипом' }
        ]
      },
      {
        id: 'nav',
        title: 'Меню навигации',
        fields: [
          { key: 'nav_about', label: 'Пункт «О нас»' },
          { key: 'nav_consultation', label: 'Пункт «Консультация»' },
          { key: 'nav_services', label: 'Пункт «Услуги»' },
          { key: 'nav_reviews', label: 'Пункт «Отзывы»' },
          { key: 'nav_contacts', label: 'Пункт «Контакты»' },
          { key: 'nav_staff', label: 'Пункт входа для сотрудников' }
        ]
      },
      {
        id: 'hero',
        title: 'Главный экран',
        fields: [
          { key: 'hero_slogan_html', label: 'Заголовок-слоган', html: true, rows: 2 },
          { key: 'hero_text', label: 'Основной текст' },
          { key: 'hero_subtext', label: 'Подзаголовок', textarea: true },
          { key: 'hero_stat_rating', label: 'Рейтинг (число)' },
          { key: 'hero_stat_rating_label', label: 'Подпись к рейтингу' },
          { key: 'hero_stat_reviews', label: 'Количество отзывов' },
          { key: 'hero_stat_reviews_label', label: 'Подпись к отзывам' },
          { key: 'hero_cta_book', label: 'Кнопка «Записаться»' },
          { key: 'hero_cta_consult', label: 'Кнопка «Бесплатная консультация»' },
          { key: 'hero_cta_book_consult', label: 'Кнопка «Записаться на консультацию»' },
          { key: 'hero_cta_services', label: 'Кнопка «Смотреть услуги»' }
        ]
      },
      {
        id: 'links',
        title: 'Ссылки записи и карты',
        fields: [
          { key: 'booking_url', label: 'Ссылка онлайн-записи (все кнопки «Записаться»)' },
          { key: 'consultation_cta_label', label: 'Кнопка «Получить рекомендации»' },
          { key: 'footer_map_url', label: 'Ссылка на карту (2ГИС / Яндекс)' },
          { key: 'footer_cta_label', label: 'Кнопка «Записаться» в подвале' }
        ]
      },
      {
        id: 'about',
        title: 'О студии',
        fields: [
          { key: 'about_eyebrow', label: 'Подзаголовок секции' },
          { key: 'about_title_html', label: 'Заголовок', html: true },
          { key: 'about_checklist', label: 'Список пунктов (каждый с новой строки)', list: true }
        ]
      },
      {
        id: 'audience',
        title: 'Для кого студия',
        fields: [
          { key: 'audience_eyebrow', label: 'Подзаголовок секции' },
          { key: 'audience_title_html', label: 'Заголовок', html: true },
          { key: 'audience_lead', label: 'Вводный текст' },
          { key: 'audience_list', label: 'Список (каждый с новой строки)', list: true }
        ]
      },
      {
        id: 'consultation',
        title: 'Консультация',
        fields: [
          { key: 'consultation_eyebrow', label: 'Подзаголовок секции' },
          { key: 'consultation_title_html', label: 'Заголовок', html: true },
          { key: 'consultation_quote_html', label: 'Цитата', html: true, textarea: true },
          { key: 'consultation_steps_title', label: 'Заголовок списка' },
          { key: 'consultation_steps', label: 'Пункты консультации (каждый с новой строки)', list: true },
          { key: 'consultation_free_1', label: 'Бесплатная услуга 1' },
          { key: 'consultation_free_2', label: 'Бесплатная услуга 2' }
        ]
      },
      {
        id: 'master',
        title: 'О мастере',
        fields: [
          { key: 'master_eyebrow', label: 'Подзаголовок секции' },
          { key: 'master_title_html', label: 'Имя мастера', html: true },
          { key: 'master_role', label: 'Специализация' },
          { key: 'master_p1', label: 'Абзац 1', textarea: true },
          { key: 'master_p2', label: 'Абзац 2', textarea: true },
          { key: 'master_highlight', label: 'Выделенная фраза', textarea: true }
        ]
      },
      {
        id: 'approach',
        title: 'Наш подход',
        fields: [
          { key: 'approach_eyebrow', label: 'Подзаголовок секции' },
          { key: 'approach_title_html', label: 'Заголовок', html: true },
          { key: 'approach_subtitle_html', label: 'Подзаголовок', html: true },
          { key: 'approach_lead', label: 'Вводный текст', textarea: true },
          { key: 'approach_card_title_html', label: 'Заголовок карточки', html: true },
          { key: 'approach_grid', label: 'Пункты сетки (каждый с новой строки)', list: true },
          { key: 'approach_principles_title_html', label: 'Заголовок принципов', html: true },
          { key: 'approach_principles_list_html', label: 'Принципы (HTML, каждый с новой строки)', listHtml: true }
        ]
      },
      {
        id: 'services_header',
        title: 'Заголовок раздела «Услуги»',
        fields: [
          { key: 'services_eyebrow', label: 'Подзаголовок' },
          { key: 'services_title_html', label: 'Заголовок', html: true },
          { key: 'services_lead', label: 'Описание', textarea: true }
        ]
      },
      {
        id: 'benefits',
        title: 'Что вы получите',
        fields: [
          { key: 'benefits_eyebrow', label: 'Подзаголовок' },
          { key: 'benefits_title_html', label: 'Заголовок', html: true },
          { key: 'benefits_lead', label: 'Вводный текст' },
          { key: 'benefits_items', label: 'Пункты (каждый с новой строки)', list: true }
        ]
      },
      {
        id: 'faq',
        title: 'Частые сомнения',
        fields: [
          { key: 'faq_eyebrow', label: 'Подзаголовок' },
          { key: 'faq_title_html', label: 'Заголовок', html: true },
          { key: 'faq_items', label: 'Вопросы и ответы', faq: true }
        ]
      },
      {
        id: 'reviews_header',
        title: 'Заголовок отзывов',
        fields: [
          { key: 'reviews_eyebrow', label: 'Подзаголовок' },
          { key: 'reviews_title_html', label: 'Заголовок', html: true },
          { key: 'reviews_lead', label: 'Описание' },
          { key: 'reviews', label: 'Отзывы клиентов', reviews: true }
        ]
      },
      {
        id: 'format',
        title: 'Стоимость и формат',
        fields: [
          { key: 'format_eyebrow', label: 'Подзаголовок' },
          { key: 'format_title_html', label: 'Заголовок', html: true },
          { key: 'format_card_1_price', label: 'Карточка 1 — цена/метка' },
          { key: 'format_card_1_text', label: 'Карточка 1 — текст' },
          { key: 'format_card_2_price', label: 'Карточка 2 — цена/метка' },
          { key: 'format_card_2_text', label: 'Карточка 2 — текст' },
          { key: 'format_card_3_price', label: 'Карточка 3 — цена/метка' },
          { key: 'format_card_3_text', label: 'Карточка 3 — текст' }
        ]
      },
      {
        id: 'booking',
        title: 'Блок записи',
        fields: [
          { key: 'booking_title_html', label: 'Заголовок', html: true },
          { key: 'booking_text', label: 'Текст', textarea: true },
          { key: 'booking_principles', label: 'Принципы (каждый с новой строки)', list: true }
        ]
      },
      {
        id: 'footer',
        title: 'Подвал и контакты',
        fields: [
          { key: 'footer_name', label: 'Название студии' },
          { key: 'footer_master', label: 'Имя мастера' },
          { key: 'footer_spec', label: 'Специализации' },
          { key: 'footer_contacts_title', label: 'Заголовок «Контакты»' },
          { key: 'footer_address', label: 'Адрес' },
          { key: 'footer_entrance', label: 'Как пройти' },
          { key: 'footer_phone', label: 'Телефон (для ссылки)' },
          { key: 'footer_phone_label', label: 'Телефон (текст)' },
          { key: 'footer_vk', label: 'ВКонтакте (текст)' },
          { key: 'footer_vk_url', label: 'ВКонтакте (ссылка)' },
          { key: 'footer_booking_label', label: 'Онлайн-запись (текст)' },
          { key: 'footer_booking_url', label: 'Онлайн-запись (ссылка)' },
          { key: 'footer_site_label', label: 'Сайт (текст)' },
          { key: 'footer_site_url', label: 'Сайт (ссылка)' },
          { key: 'footer_hours', label: 'Часы работы' },
          { key: 'footer_legal_note', label: 'Правовая сноска' }
        ]
      }
    ]
  };
})();
