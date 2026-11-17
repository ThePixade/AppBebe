<?php
/*
 * AppBébé — synchronisation entre téléphones via le NAS.
 *
 * GET  api.php                       → {"app":"appfamille","rev":N,"data":{...}|null}
 * POST api.php  (en-tête X-Base-Rev) → enregistre si X-Base-Rev == rev courante,
 *                                      sinon 409 + état courant (le client fusionne).
 *
 * Les données sont rangées dans appfamille-data.php, protégé contre la lecture
 * directe par une première ligne PHP qui coupe l'exécution.
 * Compatible PHP 5.6+ (serveur web intégré des NAS QNAP).
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

// Mode test : si le dossier ../appbebe contient déjà des données, AppFamille les utilise directement
// (même fichier qu'AppBébé). Pour des données séparées : créer un fichier vide « no-link-appbebe » à côté de api.php.
$linked = dirname(__DIR__) . '/appbebe/appbebe-data.php';
define('DATA_FILE', (is_file($linked) && !is_file(__DIR__ . '/no-link-appbebe')) ? $linked : __DIR__ . '/appfamille-data.php');
define('GUARD', "<?php http_response_code(403); exit; ?>\n");
define('MAX_BYTES', 8 * 1024 * 1024);

function reply($code, $body) {
    http_response_code($code);
    echo $body;
    exit;
}

function read_store($fp) {
    rewind($fp);
    $raw = stream_get_contents($fp);
    if ($raw === false || $raw === '') return array(0, 'null');
    $parts = explode("\n", $raw, 3);
    if (count($parts) < 3) return array(0, 'null');
    return array((int) $parts[1], $parts[2]);
}

function state_json($rev, $data) {
    return '{"app":"appfamille","rev":' . (int) $rev . ',"data":' . $data . '}';
}

if (!file_exists(DATA_FILE) && !is_writable(dirname(DATA_FILE))) {
    reply(500, '{"app":"appfamille","error":"not_writable"}');
}

$method = $_SERVER['REQUEST_METHOD'];
$fp = @fopen(DATA_FILE, 'c+');
if (!$fp) reply(500, '{"app":"appfamille","error":"not_writable"}');

if ($method === 'GET') {
    flock($fp, LOCK_SH);
    list($rev, $data) = read_store($fp);
    flock($fp, LOCK_UN);
    reply(200, state_json($rev, $data));
}

if ($method === 'POST') {
    $body = file_get_contents('php://input');
    if ($body === false || strlen($body) === 0 || strlen($body) > MAX_BYTES) reply(413, '{"app":"appfamille","error":"size"}');
    $decoded = json_decode($body);
    if (!is_object($decoded)) reply(400, '{"app":"appfamille","error":"invalid_json"}');
    $base = isset($_SERVER['HTTP_X_BASE_REV']) ? (int) $_SERVER['HTTP_X_BASE_REV'] : -1;

    flock($fp, LOCK_EX);
    list($rev, $data) = read_store($fp);
    if ($base !== $rev) {
        flock($fp, LOCK_UN);
        reply(409, state_json($rev, $data));
    }
    $next = $rev + 1;
    ftruncate($fp, 0);
    rewind($fp);
    $ok = fwrite($fp, GUARD . $next . "\n" . $body);
    fflush($fp);
    flock($fp, LOCK_UN);
    if ($ok === false) reply(500, '{"app":"appfamille","error":"not_writable"}');
    reply(200, '{"app":"appfamille","rev":' . $next . '}');
}

reply(405, '{"app":"appfamille","error":"method"}');
