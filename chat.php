<?php
/*
 * AppFamille — discussion de famille en direct (fil unique), stockée sur le NAS.
 *
 * GET  chat.php?since=N      → {"app":"appfamille","last":N,"msgs":[…]}  (messages d'identifiant > N ; since=0 : les 60 derniers)
 * GET  chat.php?img=NOM      → renvoie une photo envoyée dans la discussion
 * POST chat.php {by,text?,img?,share?} → ajoute un message et le renvoie
 * POST chat.php {action:'delete',id,by} → supprime un de ses messages ; {action:'clear'} vide la discussion
 *
 * Les messages sont rangés (un par ligne) dans appfamille-chat.php, à côté du fichier de données :
 * toutes les éditions (AppFamille, AppPre) partagent donc la même discussion.
 * Compatible PHP 5.6+.
 */

header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

$linked = null;
$parent = dirname(__DIR__);
foreach ((array) @scandir($parent) as $d) {
    $dir = $parent . '/' . $d;
    if (strtolower($d) === 'appbebe' && is_dir($dir) && realpath($dir) !== realpath(__DIR__) && is_file($dir . '/appbebe-data.php')) { $linked = $dir; break; }
}
$base = ($linked && !is_file(__DIR__ . '/no-link-appbebe')) ? $linked : __DIR__;
define('CHAT_FILE', $base . '/appfamille-chat.php');
define('IMG_DIR', $base . '/appfamille-chat-img');
define('GUARD', "<?php http_response_code(403); exit; ?>\n");
define('KEEP', 500);

function reply($code, $arr) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    $arr['app'] = 'appfamille';
    echo json_encode($arr);
    exit;
}

function load_msgs($fp) {
    rewind($fp);
    $raw = stream_get_contents($fp);
    $out = array();
    if ($raw === false || $raw === '') return $out;
    $lines = explode("\n", $raw);
    array_shift($lines); // ligne de protection
    foreach ($lines as $l) {
        if ($l === '') continue;
        $m = json_decode($l, true);
        if (is_array($m) && isset($m['id'])) $out[] = $m;
    }
    return $out;
}

// Photo
if (isset($_GET['img'])) {
    $name = basename($_GET['img']);
    $path = IMG_DIR . '/' . $name;
    if (!preg_match('/^[a-z0-9_]+\.jpg$/', $name) || !is_file($path)) { http_response_code(404); exit; }
    header('Content-Type: image/jpeg');
    header('Cache-Control: public, max-age=31536000');
    readfile($path);
    exit;
}

$fp = @fopen(CHAT_FILE, 'c+');
if (!$fp) reply(500, array('error' => 'not_writable'));
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    flock($fp, LOCK_SH);
    $msgs = load_msgs($fp);
    flock($fp, LOCK_UN);
    $since = isset($_GET['since']) ? (int) $_GET['since'] : 0;
    $last = count($msgs) ? $msgs[count($msgs) - 1]['id'] : 0;
    $out = array();
    foreach ($msgs as $m) if ($m['id'] > $since) $out[] = $m;
    if ($since === 0) $out = array_slice($out, -60);
    $ids = array();
    foreach ($msgs as $m) $ids[] = $m['id'];
    reply(200, array('last' => $last, 'msgs' => $out, 'ids' => $ids));
}

if ($method === 'POST') {
    $body = file_get_contents('php://input');
    if ($body === false || strlen($body) === 0 || strlen($body) > 6 * 1024 * 1024) reply(413, array('error' => 'size'));
    $in = json_decode($body, true);
    if (!is_array($in)) reply(400, array('error' => 'invalid_json'));

    if (isset($in['action']) && ($in['action'] === 'delete' || $in['action'] === 'clear')) {
        $who = isset($in['by']) ? (string) $in['by'] : '';
        flock($fp, LOCK_EX);
        $msgs = load_msgs($fp);
        $keep = array(); $gone = array();
        foreach ($msgs as $m) {
            $hit = $in['action'] === 'clear' || ($m['id'] === (int) (isset($in['id']) ? $in['id'] : -1) && isset($m['by']) && $m['by'] === $who);
            if ($hit) $gone[] = $m; else $keep[] = $m;
        }
        $raw = GUARD;
        foreach ($keep as $m) $raw .= json_encode($m) . "\n";
        ftruncate($fp, 0); rewind($fp); fwrite($fp, $raw); fflush($fp); flock($fp, LOCK_UN);
        foreach ($gone as $m) if (isset($m['img'])) @unlink(IMG_DIR . '/' . basename($m['img']));
        reply(200, array('deleted' => count($gone)));
    }

    $text = isset($in['text']) ? trim((string) $in['text']) : '';
    if (function_exists('mb_substr')) $text = mb_substr($text, 0, 2000, 'UTF-8'); else $text = substr($text, 0, 2000);
    $by = isset($in['by']) ? substr(trim((string) $in['by']), 0, 30) : '';
    $msg = array('by' => $by, 'at' => time() * 1000);
    if ($text !== '') $msg['text'] = $text;

    if (isset($in['share']) && is_array($in['share'])) {
        $sh = array('title' => substr(isset($in['share']['title']) ? (string) $in['share']['title'] : '', 0, 80), 'lines' => array(), 'route' => '');
        if (isset($in['share']['lines']) && is_array($in['share']['lines'])) foreach (array_slice($in['share']['lines'], 0, 8) as $ln) $sh['lines'][] = substr((string) $ln, 0, 120);
        if (isset($in['share']['route']) && preg_match('/^#\/[a-z]+$/', (string) $in['share']['route'])) $sh['route'] = $in['share']['route'];
        $msg['share'] = $sh;
    }

    $imgName = null;
    if (isset($in['img']) && is_string($in['img']) && preg_match('#^data:image/(jpeg|png|webp);base64,#', $in['img'])) {
        $bin = base64_decode(substr($in['img'], strpos($in['img'], ',') + 1), true);
        if ($bin === false || strlen($bin) > 4 * 1024 * 1024 || @getimagesizefromstring($bin) === false) reply(400, array('error' => 'bad_image'));
        if (!is_dir(IMG_DIR)) @mkdir(IMG_DIR, 0755, true);
        $imgName = date('Ymd') . '_' . bin2hex(openssl_random_pseudo_bytes(6)) . '.jpg';
        if (@file_put_contents(IMG_DIR . '/' . $imgName, $bin) === false) reply(500, array('error' => 'not_writable'));
        $msg['img'] = $imgName;
    }
    if (!isset($msg['text']) && !isset($msg['img']) && !isset($msg['share'])) reply(400, array('error' => 'empty'));

    flock($fp, LOCK_EX);
    $msgs = load_msgs($fp);
    $msg['id'] = count($msgs) ? $msgs[count($msgs) - 1]['id'] + 1 : 1;
    $msgs[] = $msg;
    $dropped = array();
    if (count($msgs) > KEEP) { $dropped = array_slice($msgs, 0, count($msgs) - KEEP); $msgs = array_slice($msgs, -KEEP); }
    $raw = GUARD;
    foreach ($msgs as $m) $raw .= json_encode($m) . "\n";
    ftruncate($fp, 0);
    rewind($fp);
    $ok = fwrite($fp, $raw);
    fflush($fp);
    flock($fp, LOCK_UN);
    if ($ok === false) reply(500, array('error' => 'not_writable'));
    foreach ($dropped as $m) if (isset($m['img'])) @unlink(IMG_DIR . '/' . basename($m['img']));
    reply(200, array('msg' => $msg));
}

reply(405, array('error' => 'method'));
