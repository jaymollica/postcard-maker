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

error_log("BE LOADING");

$server = new \Jacwright\RestServer\RestServer('debug');

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

$current_origin = get_origin();

// Log for debugging
error_log("=== REQUEST DEBUG ===");
error_log("Method: " . $_SERVER['REQUEST_METHOD']);
error_log("Origin: " . $current_origin);
error_log("Allowed origins: " . json_encode($allowed_origins));

// Set CORS header for all allowed origins
if( in_array($current_origin, $allowed_origins) ){
    header("Access-Control-Allow-Origin: " . $current_origin);
}

// Handle OPTIONS preflight requests BEFORE they reach controllers
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    error_log("OPTIONS request - sending CORS headers and exiting");

    // Always send CORS headers for OPTIONS if origin is allowed
    if (in_array($current_origin, $allowed_origins)) {
        header("Access-Control-Allow-Origin: " . $current_origin);
        header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
        header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Access-Control-Allow-Origin");
        header("Access-Control-Max-Age: 86400");
    }

    http_response_code(200);
    exit(0);
}

$server->addClass('StripeController');
$server->addClass('LobController');
$server->addClass('AWSController');
$server->addClass('NonceController');
$server->addClass('EmailController');
$server->addClass('CostController');

$server->handle();
