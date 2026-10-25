# Серверная часть (не веб-корень)

Исходники Node API для будущего запуска вне статической раздачи сайта.

Рабочие исходники API лежат в `operator-ops/backend/` (не для публичной раздачи).  
В веб-корне `ops/backend/` — только заглушки 404.  
На Timeweb команда сборки: `npm run build` (удаляет `docs`, `ops`, `operator-docs`, `operator-ops` с публичного диска).  
Либо вручную: `rm -rf docs ops operator-docs operator-ops`.  
Дополнительно в Caddyfile: `/ops/*`, `/docs/*`, `/operator-docs/*`, `/operator-ops/*`, `/backend/*`, `/server/*` → 404.
