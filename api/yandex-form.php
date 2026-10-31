<?php
declare(strict_types=1);

/**
 * Same-origin прокси отправки в Яндекс.Формы (gateway postSurvey).
 * Секреты и OAuth не используются; CSRF получается сервером с forms.yandex.ru.
 * Персональные данные в лог не пишутся.
 */

const YANDEX_GATEWAY = 'https://forms.yandex.ru/u/gateway/root/form/postSurvey';

const ALLOWED_ORIGINS = [
    'https://studia-mai.ru',
    'https://www.studia-mai.ru',
];

const SURVEYS = [
    'booking' => [
        'id' => '6ad643dd852af364ddc7a26c',
        'page' => 'https://forms.yandex.ru/u/6ad643dd852af364ddc7a26c/',
        'fields' => [
            'answer_short_text_9008991681738688' => 200,
            'answer_short_text_9008991681800748' => 200,
            'answer_short_text_9008991681939734' => 40,
            'answer_short_text_9008991681974672' => 2000,
            'answer_boolean_9008991682017890' => 0,
        ],
    ],
    'review' => [
        'id' => '6ad64997c45c0750253c7ad8',
        'page' => 'https://forms.yandex.ru/u/6ad64997c45c0750253c7ad8/?iframe=1',
        'fields' => [
            'answer_long_text_96199' => 4000,
            'answer_short_text_9008991683293520' => 8000,
        ],
    ],
];

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method'], JSON_UNESCAPED_UNICODE);
    exit;
}

if (!is_allowed_request_origin()) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'origin'], JSON_UNESCAPED_UNICODE);
    exit;
}

if (!rate_limit_ok(client_ip())) {
    http_response_code(429);
    echo json_encode(['ok' => false, 'error' => 'rate_limit'], JSON_UNESCAPED_UNICODE);
    exit;
}

$raw = file_get_contents('php://input', false, null, 0, 16384);
if ($raw === false || $raw === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'body'], JSON_UNESCAPED_UNICODE);
    exit;
}

$data = json_decode($raw, true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'json'], JSON_UNESCAPED_UNICODE);
    exit;
}

$formKey = isset($data['form']) ? (string) $data['form'] : '';
if (!isset(SURVEYS[$formKey])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'form'], JSON_UNESCAPED_UNICODE);
    exit;
}

$config = SURVEYS[$formKey];
$surveyId = $config['id'];
$incoming = isset($data['values']) && is_array($data['values']) ? $data['values'] : [];
$values = sanitize_values($incoming, $config['fields']);
if ($values === null) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'values'], JSON_UNESCAPED_UNICODE);
    exit;
}

$startedAt = normalize_started_at($data['startedAt'] ?? null);
$parent = sanitize_parent($data['parent'] ?? '');

$session = yandex_session($config['page']);
if ($session === null) {
    http_response_code(502);
    echo json_encode(['ok' => false, 'error' => 'upstream'], JSON_UNESCAPED_UNICODE);
    exit;
}

$payload = json_encode([
    'surveyId' => $surveyId,
    'values' => $values,
    'parent' => $parent,
    'startedAt' => $startedAt,
], JSON_UNESCAPED_UNICODE);

$referer = $config['page'];
$headers = [
    'Content-Type: application/json',
    'Accept: application/json',
    'X-CSRF-Token: ' . $session['csrf'],
    'x-form-referer: ' . $referer,
    'x-form-started-at: ' . (string) $startedAt,
    'x-survey-id: ' . $surveyId,
];

$response = http_post(YANDEX_GATEWAY, $payload, $headers, $session['cookie']);
if ($response === null) {
    http_response_code(502);
    echo json_encode(['ok' => false, 'error' => 'submit'], JSON_UNESCAPED_UNICODE);
    exit;
}

$status = $response['status'];
$body = $response['body'];
$parsed = json_decode($body, true);

if ($status >= 200 && $status < 300 && is_array($parsed) && !empty($parsed['answer_key'])) {
    echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
    exit;
}

http_response_code(502);
echo json_encode(['ok' => false, 'error' => 'yandex'], JSON_UNESCAPED_UNICODE);

// --- helpers ---

function is_allowed_request_origin(): bool
{
    $host = strtolower($_SERVER['HTTP_HOST'] ?? '');
    if ($host === 'studia-mai.ru' || $host === 'www.studia-mai.ru') {
        return true;
    }
    if ($host === 'localhost' || str_starts_with($host, '127.0.0.1')) {
        return true;
    }

    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '' && in_array($origin, ALLOWED_ORIGINS, true)) {
        return true;
    }

    $ref = $_SERVER['HTTP_REFERER'] ?? '';
    foreach (ALLOWED_ORIGINS as $allowed) {
        if ($ref !== '' && str_starts_with($ref, $allowed)) {
            return true;
        }
    }

    return false;
}

function client_ip(): string
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    return preg_replace('/[^0-9a-fA-F:.]/', '', $ip) ?: '0.0.0.0';
}

function rate_limit_ok(string $ip): bool
{
    $dir = sys_get_temp_dir() . '/studia-mai-yandex-form';
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) {
        return true;
    }
    $file = $dir . '/' . hash('sha256', $ip) . '.cnt';
    $now = time();
    $window = 60;
    $max = 8;
    $count = 0;
    $start = $now;
    if (is_file($file)) {
        $parts = explode(' ', (string) file_get_contents($file), 2);
        if (count($parts) === 2) {
            $start = (int) $parts[0];
            $count = (int) $parts[1];
        }
    }
    if ($now - $start >= $window) {
        $start = $now;
        $count = 0;
    }
    $count++;
    @file_put_contents($file, $start . ' ' . $count, LOCK_EX);
    return $count <= $max;
}

function sanitize_values(array $incoming, array $schema): ?array
{
    $out = [];
    foreach ($schema as $field => $maxLen) {
        if (!array_key_exists($field, $incoming)) {
            return null;
        }
        $v = $incoming[$field];
        if ($maxLen === 0) {
            $out[$field] = $v === true || $v === 'true' || $v === 1 || $v === '1';
            continue;
        }
        if (!is_string($v) && !is_numeric($v)) {
            return null;
        }
        $s = trim((string) $v);
        if ($maxLen > 0 && mb_strlen($s, 'UTF-8') > $maxLen) {
            $s = mb_substr($s, 0, $maxLen, 'UTF-8');
        }
        $out[$field] = $s;
    }
    if (array_diff_key($incoming, $schema) !== []) {
        return null;
    }
    return $out;
}

function normalize_started_at($value): int
{
    $now = (int) round(microtime(true) * 1000);
    if (is_numeric($value)) {
        $t = (int) $value;
        if ($t > 1_000_000_000_000) {
            if ($t > $now + 300_000) {
                return $now;
            }
            if ($t < $now - 86_400_000) {
                return $now;
            }
            return $t;
        }
    }
    return $now;
}

function sanitize_parent($value): string
{
    $s = trim((string) $value);
    if ($s === '') {
        return '';
    }
    if (strlen($s) > 512) {
        $s = substr($s, 0, 512);
    }
    if (!preg_match('#^https://([a-z0-9.-]*\.)?studia-mai\.ru/#i', $s)) {
        return 'https://studia-mai.ru/';
    }
    return $s;
}

function yandex_session(string $pageUrl): ?array
{
    $cookieFile = tempnam(sys_get_temp_dir(), 'yfc');
    if ($cookieFile === false) {
        return null;
    }

    $html = http_get($pageUrl, $cookieFile);
    if ($html === null) {
        @unlink($cookieFile);
        return null;
    }

    if (!preg_match('/"csrfToken":"([^"]+)"/', $html, $m)) {
        @unlink($cookieFile);
        return null;
    }
    $csrf = $m[1];
    $cookie = read_csrf_cookie($cookieFile);
    @unlink($cookieFile);
    if ($cookie === '') {
        $cookie = 'CSRF-TOKEN=' . rawurlencode($csrf);
    }

    return ['csrf' => $csrf, 'cookie' => $cookie];
}

function read_csrf_cookie(string $cookieFile): string
{
    if (!is_readable($cookieFile)) {
        return '';
    }
    $lines = file($cookieFile, FILE_IGNORE_NEW_LINES);
    if ($lines === false) {
        return '';
    }
    foreach ($lines as $line) {
        if ($line === '' || $line[0] === '#') {
            continue;
        }
        $parts = explode("\t", $line);
        if (count($parts) >= 7 && $parts[5] === 'CSRF-TOKEN') {
            return 'CSRF-TOKEN=' . $parts[6];
        }
    }
    return '';
}

function http_get(string $url, string $cookieFile): ?string
{
    if (!function_exists('curl_init')) {
        return null;
    }
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_COOKIEJAR => $cookieFile,
        CURLOPT_COOKIEFILE => $cookieFile,
        CURLOPT_HTTPHEADER => [
            'Accept: text/html,application/xhtml+xml',
            'User-Agent: StudiaMaiFormProxy/1.0 (+https://studia-mai.ru/)',
        ],
    ]);
    $body = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($body === false || $code < 200 || $code >= 400) {
        return null;
    }
    return (string) $body;
}

function http_post(string $url, string $body, array $headers, string $cookie): ?array
{
    if (!function_exists('curl_init')) {
        return null;
    }
    if ($cookie !== '') {
        $headers[] = 'Cookie: ' . $cookie;
    }
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_HTTPHEADER => $headers,
    ]);
    $respBody = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($respBody === false) {
        return null;
    }
    return ['status' => $status, 'body' => (string) $respBody];
}
