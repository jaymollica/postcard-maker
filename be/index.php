<?php
// need this bc RestServer 1.2.0 needs to be updated to support php 8.2
error_reporting(E_ALL ^ E_DEPRECATED);

// autoload composer packages
require 'vendor/autoload.php';

// load the env
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

// get origin function
function get_origin(){
    $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : $_SERVER['HTTP_HOST'];
    return $origin;
}

// nonce funcs ... expiry is 24hrs
function generate_nonce($action) {
    $nonce_key = $_ENV['NONCE_KEY']; // Replace with your own secret key
    $timestamp = time();
    $nonce = hash('sha256', $timestamp . $action . $nonce_key) . '-' . $timestamp;
    return $nonce;
}

function verify_nonce($nonce, $action, $lifetime = 86400) {
    $nonce_key = $_ENV['NONCE_KEY']; // Replace with your own secret key
    $parts = explode('-', $nonce);
    if (count($parts) !== 2) {
        return false;
    }

    $hash = $parts[0];
    $timestamp = (int) $parts[1];
    $expected_nonce = hash('sha256', $timestamp . $action . $nonce_key);

    // Check if the nonce has expired
    if (time() - $timestamp > $lifetime) {
        return false;
    }

    // Check if the nonce hash matches the expected value
    if ($hash !== $expected_nonce) {
        return false;
    }

    return true;
}

/**
 * the default cost of sending a 4x6 postcard with Lob
 */
// global $default_cost;
// $default_cost = 80;

function get_domain_for_url($artist_url) {
    global $domain_template_map;
    if (empty($artist_url)) {
        return null;
    }
    $idx = array_search($artist_url, array_column($domain_template_map, 'url'));
    if ($idx !== false) {
        return $domain_template_map[$idx]->domain;
    }
    return parse_url($artist_url, PHP_URL_HOST);
}

// Map an ISO-3166 alpha-2 country code (what the frontend dropdown sends) to
// the uppercase country name we want printed on the postcard. Returns '' for
// US (so the country line collapses on domestic mail) and the uppercased input
// for unknown codes so issues are visible rather than silent.
function country_name_for_code($code) {
    static $names = array(
        'US' => '',
        'CA' => 'CANADA',
        'GB' => 'UNITED KINGDOM',
        'AU' => 'AUSTRALIA',
        'FR' => 'FRANCE',
        'DE' => 'GERMANY',
        'IT' => 'ITALY',
        'ES' => 'SPAIN',
        'JP' => 'JAPAN',
        'MX' => 'MEXICO',
    );
    $code = strtoupper(trim((string) $code));
    if (array_key_exists($code, $names)) {
        return $names[$code];
    }
    return $code;
}

function slug_for_domain($domain) {
    return strtolower(preg_replace('/[^a-z0-9]+/i', '-', $domain));
}

function origin_from_url($url) {
    if (empty($url)) return null;
    $parts = parse_url($url);
    if (!$parts || !isset($parts['scheme'], $parts['host'])) return null;
    $origin = $parts['scheme'] . '://' . $parts['host'];
    if (isset($parts['port'])) {
        $is_default = ($parts['scheme'] === 'https' && $parts['port'] == 443)
            || ($parts['scheme'] === 'http' && $parts['port'] == 80);
        if (!$is_default) {
            $origin .= ':' . $parts['port'];
        }
    }
    return $origin;
}

// Reverse the slug embedded in an S3 image URL by AWSController back to the
// canonical domain it was uploaded from. Returns null if no whitelist slug
// matches the key prefix.
function get_domain_from_imgurl($img_url) {
    global $domain_template_map;
    if (empty($img_url)) return null;
    $path = parse_url($img_url, PHP_URL_PATH);
    if (!$path) return null;
    $key = ltrim($path, '/');
    foreach ($domain_template_map as $entry) {
        $slug = slug_for_domain($entry->domain);
        if (strpos($key, $slug . '--') === 0) {
            return $entry->domain;
        }
    }
    return null;
}

function get_cost_for_domain($domain_url, $country = 'US') {
    global $domain_template_map;

    $domain_config = null;
    foreach ($domain_template_map as $config) {
        if ($config->url === $domain_url) {
            $domain_config = $config;
            break;
        }
    }

    // Determine if international
    $is_international = strtoupper($country) !== 'US';

    if ($is_international) {
        // Return international cost or fallback to 500 ($5.00)
        return $domain_config->cost_international ?? 500;
    } else {
        // Return domestic cost or fallback to 80 ($0.80)
        return $domain_config->cost ?? 80;
    }
}

// api controllers/setup
require './controllers/StripeController.php';
require './controllers/LobController.php';
require './controllers/AWSController.php';
require './controllers/NonceController.php';
require './controllers/EmailController.php';
require './controllers/CostController.php';
require './controllers/TrackingController.php';
require './controllers/IntegrationController.php';

$server = new \Jacwright\RestServer\RestServer('production');

// domains & templates for CORS & Lob routing purposes
global $domain_template_map;
$domain_template_map_string = file_get_contents('./.domain-template-map.json');
$domain_template_map = json_decode($domain_template_map_string);
$allowed_origins = array_column($domain_template_map, 'url');

$server->useCors = true;
// $server->allowedOrigin = 'http://example.com';
// or use array of multiple origins
$server->allowedOrigin = $allowed_origins;
// or a wildcard
// $server->allowedOrigin = '*';

if( in_array(get_origin(), $allowed_origins) ){
    header("Access-Control-Allow-Origin: " . get_origin());
}



$server->addClass('StripeController');
$server->addClass('LobController');
$server->addClass('AWSController');
$server->addClass('NonceController');
$server->addClass('EmailController');
$server->addClass('CostController');
$server->addClass('TrackingController');
$server->addClass('IntegrationController');

$server->handle();
