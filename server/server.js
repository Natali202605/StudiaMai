/**
 * Публичная выдача исходного кода API отключена (152-ФЗ / безопасность).
 * Рабочий код сервера хранится в каталоге /backend и не предназначен
 * для статической раздачи с веб-корня. Запросы к /server/* должны
 * отвечать 404 (см. Caddyfile и server/.htaccess).
 */
'use strict';
throw new Error('Forbidden: /server is not a public endpoint');
