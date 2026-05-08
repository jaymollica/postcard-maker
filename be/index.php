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
// ISO 3166-1 alpha-2 → uppercase English country name, used as the
// `recipientCountryLine` merge variable on the postcard back template
// for international mail. US returns an empty string so the country
// line collapses (Lob's auto-rendered address block already covers US).
// Mirrors the COUNTRIES list in fe/src/components/form.js — keep them
// in sync if the FE dropdown changes.
function country_name_for_code($code) {
    static $names = array(
        'US' => '',
        'AF' => 'AFGHANISTAN', 'AX' => 'ÅLAND ISLANDS', 'AL' => 'ALBANIA',
        'DZ' => 'ALGERIA', 'AS' => 'AMERICAN SAMOA', 'AD' => 'ANDORRA',
        'AO' => 'ANGOLA', 'AI' => 'ANGUILLA', 'AQ' => 'ANTARCTICA',
        'AG' => 'ANTIGUA AND BARBUDA', 'AR' => 'ARGENTINA', 'AM' => 'ARMENIA',
        'AW' => 'ARUBA', 'AU' => 'AUSTRALIA', 'AT' => 'AUSTRIA',
        'AZ' => 'AZERBAIJAN', 'BS' => 'BAHAMAS', 'BH' => 'BAHRAIN',
        'BD' => 'BANGLADESH', 'BB' => 'BARBADOS', 'BY' => 'BELARUS',
        'BE' => 'BELGIUM', 'BZ' => 'BELIZE', 'BJ' => 'BENIN',
        'BM' => 'BERMUDA', 'BT' => 'BHUTAN', 'BO' => 'BOLIVIA',
        'BQ' => 'BONAIRE, SINT EUSTATIUS AND SABA', 'BA' => 'BOSNIA AND HERZEGOVINA',
        'BW' => 'BOTSWANA', 'BV' => 'BOUVET ISLAND', 'BR' => 'BRAZIL',
        'IO' => 'BRITISH INDIAN OCEAN TERRITORY', 'BN' => 'BRUNEI DARUSSALAM',
        'BG' => 'BULGARIA', 'BF' => 'BURKINA FASO', 'BI' => 'BURUNDI',
        'CV' => 'CABO VERDE', 'KH' => 'CAMBODIA', 'CM' => 'CAMEROON',
        'CA' => 'CANADA', 'KY' => 'CAYMAN ISLANDS', 'CF' => 'CENTRAL AFRICAN REPUBLIC',
        'TD' => 'CHAD', 'CL' => 'CHILE', 'CN' => 'CHINA',
        'CX' => 'CHRISTMAS ISLAND', 'CC' => 'COCOS (KEELING) ISLANDS',
        'CO' => 'COLOMBIA', 'KM' => 'COMOROS', 'CG' => 'CONGO',
        'CD' => 'CONGO (DEMOCRATIC REPUBLIC)', 'CK' => 'COOK ISLANDS',
        'CR' => 'COSTA RICA', 'CI' => 'CÔTE D\'IVOIRE', 'HR' => 'CROATIA',
        'CU' => 'CUBA', 'CW' => 'CURAÇAO', 'CY' => 'CYPRUS',
        'CZ' => 'CZECHIA', 'DK' => 'DENMARK', 'DJ' => 'DJIBOUTI',
        'DM' => 'DOMINICA', 'DO' => 'DOMINICAN REPUBLIC', 'EC' => 'ECUADOR',
        'EG' => 'EGYPT', 'SV' => 'EL SALVADOR', 'GQ' => 'EQUATORIAL GUINEA',
        'ER' => 'ERITREA', 'EE' => 'ESTONIA', 'SZ' => 'ESWATINI',
        'ET' => 'ETHIOPIA', 'FK' => 'FALKLAND ISLANDS', 'FO' => 'FAROE ISLANDS',
        'FJ' => 'FIJI', 'FI' => 'FINLAND', 'FR' => 'FRANCE',
        'GF' => 'FRENCH GUIANA', 'PF' => 'FRENCH POLYNESIA',
        'TF' => 'FRENCH SOUTHERN TERRITORIES', 'GA' => 'GABON',
        'GM' => 'GAMBIA', 'GE' => 'GEORGIA', 'DE' => 'GERMANY',
        'GH' => 'GHANA', 'GI' => 'GIBRALTAR', 'GR' => 'GREECE',
        'GL' => 'GREENLAND', 'GD' => 'GRENADA', 'GP' => 'GUADELOUPE',
        'GU' => 'GUAM', 'GT' => 'GUATEMALA', 'GG' => 'GUERNSEY',
        'GN' => 'GUINEA', 'GW' => 'GUINEA-BISSAU', 'GY' => 'GUYANA',
        'HT' => 'HAITI', 'HM' => 'HEARD ISLAND AND MCDONALD ISLANDS',
        'VA' => 'HOLY SEE (VATICAN CITY)', 'HN' => 'HONDURAS',
        'HK' => 'HONG KONG', 'HU' => 'HUNGARY', 'IS' => 'ICELAND',
        'IN' => 'INDIA', 'ID' => 'INDONESIA', 'IR' => 'IRAN',
        'IQ' => 'IRAQ', 'IE' => 'IRELAND', 'IM' => 'ISLE OF MAN',
        'IL' => 'ISRAEL', 'IT' => 'ITALY', 'JM' => 'JAMAICA',
        'JP' => 'JAPAN', 'JE' => 'JERSEY', 'JO' => 'JORDAN',
        'KZ' => 'KAZAKHSTAN', 'KE' => 'KENYA', 'KI' => 'KIRIBATI',
        'KP' => 'KOREA (NORTH)', 'KR' => 'KOREA (SOUTH)', 'KW' => 'KUWAIT',
        'KG' => 'KYRGYZSTAN', 'LA' => 'LAOS', 'LV' => 'LATVIA',
        'LB' => 'LEBANON', 'LS' => 'LESOTHO', 'LR' => 'LIBERIA',
        'LY' => 'LIBYA', 'LI' => 'LIECHTENSTEIN', 'LT' => 'LITHUANIA',
        'LU' => 'LUXEMBOURG', 'MO' => 'MACAO', 'MG' => 'MADAGASCAR',
        'MW' => 'MALAWI', 'MY' => 'MALAYSIA', 'MV' => 'MALDIVES',
        'ML' => 'MALI', 'MT' => 'MALTA', 'MH' => 'MARSHALL ISLANDS',
        'MQ' => 'MARTINIQUE', 'MR' => 'MAURITANIA', 'MU' => 'MAURITIUS',
        'YT' => 'MAYOTTE', 'MX' => 'MEXICO', 'FM' => 'MICRONESIA',
        'MD' => 'MOLDOVA', 'MC' => 'MONACO', 'MN' => 'MONGOLIA',
        'ME' => 'MONTENEGRO', 'MS' => 'MONTSERRAT', 'MA' => 'MOROCCO',
        'MZ' => 'MOZAMBIQUE', 'MM' => 'MYANMAR', 'NA' => 'NAMIBIA',
        'NR' => 'NAURU', 'NP' => 'NEPAL', 'NL' => 'NETHERLANDS',
        'NC' => 'NEW CALEDONIA', 'NZ' => 'NEW ZEALAND', 'NI' => 'NICARAGUA',
        'NE' => 'NIGER', 'NG' => 'NIGERIA', 'NU' => 'NIUE',
        'NF' => 'NORFOLK ISLAND', 'MK' => 'NORTH MACEDONIA',
        'MP' => 'NORTHERN MARIANA ISLANDS', 'NO' => 'NORWAY', 'OM' => 'OMAN',
        'PK' => 'PAKISTAN', 'PW' => 'PALAU', 'PS' => 'PALESTINE',
        'PA' => 'PANAMA', 'PG' => 'PAPUA NEW GUINEA', 'PY' => 'PARAGUAY',
        'PE' => 'PERU', 'PH' => 'PHILIPPINES', 'PN' => 'PITCAIRN',
        'PL' => 'POLAND', 'PT' => 'PORTUGAL', 'PR' => 'PUERTO RICO',
        'QA' => 'QATAR', 'RE' => 'RÉUNION', 'RO' => 'ROMANIA',
        'RU' => 'RUSSIA', 'RW' => 'RWANDA', 'BL' => 'SAINT BARTHÉLEMY',
        'SH' => 'SAINT HELENA', 'KN' => 'SAINT KITTS AND NEVIS',
        'LC' => 'SAINT LUCIA', 'MF' => 'SAINT MARTIN (FRENCH)',
        'PM' => 'SAINT PIERRE AND MIQUELON', 'VC' => 'SAINT VINCENT AND THE GRENADINES',
        'WS' => 'SAMOA', 'SM' => 'SAN MARINO', 'ST' => 'SAO TOME AND PRINCIPE',
        'SA' => 'SAUDI ARABIA', 'SN' => 'SENEGAL', 'RS' => 'SERBIA',
        'SC' => 'SEYCHELLES', 'SL' => 'SIERRA LEONE', 'SG' => 'SINGAPORE',
        'SX' => 'SINT MAARTEN (DUTCH)', 'SK' => 'SLOVAKIA', 'SI' => 'SLOVENIA',
        'SB' => 'SOLOMON ISLANDS', 'SO' => 'SOMALIA', 'ZA' => 'SOUTH AFRICA',
        'GS' => 'SOUTH GEORGIA AND SOUTH SANDWICH ISLANDS', 'SS' => 'SOUTH SUDAN',
        'ES' => 'SPAIN', 'LK' => 'SRI LANKA', 'SD' => 'SUDAN',
        'SR' => 'SURINAME', 'SJ' => 'SVALBARD AND JAN MAYEN', 'SE' => 'SWEDEN',
        'CH' => 'SWITZERLAND', 'SY' => 'SYRIA', 'TW' => 'TAIWAN',
        'TJ' => 'TAJIKISTAN', 'TZ' => 'TANZANIA', 'TH' => 'THAILAND',
        'TL' => 'TIMOR-LESTE', 'TG' => 'TOGO', 'TK' => 'TOKELAU',
        'TO' => 'TONGA', 'TT' => 'TRINIDAD AND TOBAGO', 'TN' => 'TUNISIA',
        'TR' => 'TURKEY', 'TM' => 'TURKMENISTAN', 'TC' => 'TURKS AND CAICOS ISLANDS',
        'TV' => 'TUVALU', 'UG' => 'UGANDA', 'UA' => 'UKRAINE',
        'AE' => 'UNITED ARAB EMIRATES', 'GB' => 'UNITED KINGDOM',
        'UM' => 'UNITED STATES MINOR OUTLYING ISLANDS', 'UY' => 'URUGUAY',
        'UZ' => 'UZBEKISTAN', 'VU' => 'VANUATU', 'VE' => 'VENEZUELA',
        'VN' => 'VIETNAM', 'VG' => 'VIRGIN ISLANDS (BRITISH)',
        'VI' => 'VIRGIN ISLANDS (U.S.)', 'WF' => 'WALLIS AND FUTUNA',
        'EH' => 'WESTERN SAHARA', 'YE' => 'YEMEN', 'ZM' => 'ZAMBIA',
        'ZW' => 'ZIMBABWE',
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
