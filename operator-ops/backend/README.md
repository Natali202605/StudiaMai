# Серверная часть (не веб-корень)

Исходники Node API для будущего запуска вне статической раздачи сайта.

Рабочие исходники API лежат в `operator-ops/backend/` (не для публичной раздачи).  
Публичный сайт собирается в `dist/` командой `npm run build` — без `docs/`, `ops/`, `operator-docs/`, `operator-ops/`.  
На Timeweb (HTML/CSS/JS) укажите путь проекта: `dist`.  
Дополнительно в Caddyfile: `/ops/*`, `/docs/*`, `/operator-docs/*`, `/operator-ops/*`, `/backend/*`, `/server/*` → 404.
