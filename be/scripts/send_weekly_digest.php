#!/usr/bin/env php
<?php
declare(strict_types=1);

/**
 * Weekly email digest of Ollie Mail funnel activity, one per artist
 * whose domain entry has a digest_email in .domain-template-map.json.
 *
 * Flow:
 *   1. Pulls custom events from Umami for the last 7 days.
 *   2. Filters/aggregates each event by metadata.referring_domain so
 *      every artist domain gets its own scorecard.
 *   3. Sends the scorecard to Claude (Haiku 4.5) with a prompt asking
 *      for a short, plain-language summary written to the artist.
 *   4. Wraps the response in an HTML email and sends via Mandrill.
 *
 * Setup -- add to be/.env on the server:
 *   UMAMI_USERNAME=<your Umami admin username, default 'admin'>
 *   UMAMI_PASSWORD=<your Umami admin password>
 *   UMAMI_WEBSITE_ID=0ffd408b-d119-4243-aa03-0eb8f9a557de
 *   UMAMI_BASE_URL=https://analytics.olliemail.net/api
 *   ANTHROPIC_API_KEY=<sk-ant-...>
 *   DIGEST_DRY_RUN_RECIPIENT=jaymollica@gmail.com   # optional
 *
 * Note: Umami 3.x removed the per-user API-key UI. Self-host auth
 * is now via username+password -> JWT (POST /api/auth/login). The
 * script logs in once at start, then uses the returned token as
 * Bearer for the data calls.
 *
 * Setup -- per artist in .domain-template-map.json:
 *   { "domain": "sweetpost.art", ..., "digest_email": "artist@example.com" }
 *
 * Usage (manual run):
 *   php be/scripts/send_weekly_digest.php
 *   php be/scripts/send_weekly_digest.php --days=14    # custom window
 *   php be/scripts/send_weekly_digest.php --domain=sweetpost.art   # single domain
 *
 * Cron (weekly, Monday 9am UTC):
 *   0 9 * * 1 cd /var/www/html/be && /usr/bin/php scripts/send_weekly_digest.php >> /var/log/olliemail-digest.log 2>&1
 */

error_reporting(E_ALL ^ E_DEPRECATED);

$root = realpath(__DIR__ . '/..');
require $root . '/vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable($root);
$dotenv->load();

require_once $root . '/services/MailchimpService.php';

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;

// -----------------------------------------------------------------------
// Config
// -----------------------------------------------------------------------

$umamiBase     = rtrim($_ENV['UMAMI_BASE_URL'] ?? 'https://analytics.olliemail.net/api', '/');
$umamiUser     = $_ENV['UMAMI_USERNAME'] ?? null;
$umamiPass     = $_ENV['UMAMI_PASSWORD'] ?? null;
$umamiSiteId   = $_ENV['UMAMI_WEBSITE_ID'] ?? null;
$anthropicKey  = $_ENV['ANTHROPIC_API_KEY'] ?? null;
$dryRunTo      = $_ENV['DIGEST_DRY_RUN_RECIPIENT'] ?? null;

foreach (['UMAMI_USERNAME', 'UMAMI_PASSWORD', 'UMAMI_WEBSITE_ID', 'ANTHROPIC_API_KEY'] as $required) {
    if (empty($_ENV[$required])) {
        fwrite(STDERR, "Missing $required in be/.env -- aborting.\n");
        exit(1);
    }
}

// CLI args: --days=N, --domain=foo.com
$opts = getopt('', ['days::', 'domain::']);
$days = (int) ($opts['days'] ?? 7);
$onlyDomain = $opts['domain'] ?? null;

$endTs   = time();
$startTs = $endTs - ($days * 86400);

// Load domain map
$mapPath = $root . '/.domain-template-map.json';
$map = json_decode(file_get_contents($mapPath));
if (!$map) {
    fwrite(STDERR, "Could not read $mapPath\n");
    exit(1);
}

$client = new Client(['timeout' => 30]);

// -----------------------------------------------------------------------
// Log in to Umami (3.x dropped UI API keys; auth is now JWT via login)
// -----------------------------------------------------------------------

$umamiKey = umami_login($client, $umamiBase, $umamiUser, $umamiPass);

// -----------------------------------------------------------------------
// Pull events from Umami once, aggregate per-domain in PHP
// -----------------------------------------------------------------------

// We only care about our funnel events.
$EVENTS_OF_INTEREST = [
    'postcard_started',
    'address_verified',
    'promo_applied',
    'payment_attempted',
    'purchase_completed',
];

// Umami v3's /event-data/events endpoint returns property histograms
// (one row per {event, property, value} with a total count) -- NOT raw
// event rows. So we pull each event's histograms once, then look up
// per-domain counts via the referring_domain property.
$aggregates = [];   // [event_name => ['by_property' => [prop => [value => count]]]]
foreach ($EVENTS_OF_INTEREST as $eventName) {
    $aggregates[$eventName] = umami_event_aggregates(
        $client, $umamiBase, $umamiKey, $umamiSiteId, $startTs, $endTs, $eventName
    );
}

// -----------------------------------------------------------------------
// Iterate domains in the whitelist; send a digest where there's activity
// -----------------------------------------------------------------------

$sent = 0;
$skipped = 0;

foreach ($map as $entry) {
    $domain = $entry->domain ?? null;
    $digestEmail = $entry->digest_email ?? null;

    if (!$domain || !$digestEmail) { $skipped++; continue; }
    if ($onlyDomain && $domain !== $onlyDomain) { $skipped++; continue; }
    if (str_contains($domain, 'localhost')) { $skipped++; continue; }

    $stats = build_domain_stats($aggregates, $domain);

    if ($stats['postcard_started'] === 0 && $stats['purchase_completed'] === 0) {
        echo "[$domain] no activity -- skipping\n";
        $skipped++;
        continue;
    }

    echo "[$domain] generating digest...\n";
    try {
        $body = generate_summary_with_claude($client, $anthropicKey, $domain, $stats, $startTs, $endTs);
    } catch (Exception $e) {
        fwrite(STDERR, "[$domain] Claude call failed: " . $e->getMessage() . "\n");
        continue;
    }

    $recipient = $dryRunTo ?: $digestEmail;
    $intendedFor = ($dryRunTo && $dryRunTo !== $digestEmail) ? $digestEmail : null;

    try {
        send_digest_email($recipient, $domain, $body, $stats, $startTs, $endTs, $intendedFor);
        echo "[$domain] sent to $recipient" . ($intendedFor ? " (would have gone to $intendedFor)" : '') . "\n";
        $sent++;
    } catch (Exception $e) {
        fwrite(STDERR, "[$domain] email send failed: " . $e->getMessage() . "\n");
    }
}

echo "\nDone. Sent: $sent. Skipped: $skipped.\n";
exit(0);

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

/**
 * Log in to Umami self-host and return the JWT to use as Bearer.
 */
function umami_login(Client $client, string $base, string $username, string $password): string {
    try {
        $resp = $client->post("$base/auth/login", [
            'headers' => ['Accept' => 'application/json', 'Content-Type' => 'application/json'],
            'body'    => json_encode(['username' => $username, 'password' => $password]),
        ]);
    } catch (RequestException $e) {
        $body = $e->hasResponse() ? (string) $e->getResponse()->getBody() : '';
        throw new RuntimeException("Umami login failed: " . $e->getMessage() . " " . substr($body, 0, 200));
    }
    $data = json_decode((string) $resp->getBody(), true);
    $token = $data['token'] ?? null;
    if (!$token) throw new RuntimeException("Umami login response missing token: " . json_encode($data));
    return $token;
}

/**
 * Pull aggregated property histograms for one event name from Umami v3.
 * Returns ['by_property' => [propertyName => [propertyValue => count, ...]]].
 *
 * Umami v3's /event-data/events endpoint pre-aggregates: each row is
 * {eventName, propertyName, propertyValue, total} -- so we fold the rows
 * into a 2-level map for easy lookups.
 */
function umami_event_aggregates(Client $client, string $base, string $key, string $siteId, int $startTs, int $endTs, string $eventName): array {
    $url = "$base/websites/$siteId/event-data/events";
    try {
        $resp = $client->get($url, [
            'headers' => ['Authorization' => "Bearer $key", 'Accept' => 'application/json'],
            'query' => [
                'startAt' => $startTs * 1000,
                'endAt'   => $endTs * 1000,
                'event'   => $eventName,
            ],
        ]);
    } catch (RequestException $e) {
        $body = $e->hasResponse() ? (string) $e->getResponse()->getBody() : '';
        throw new RuntimeException("Umami $eventName fetch failed: " . $e->getMessage() . " " . substr($body, 0, 200));
    }
    $rows = json_decode((string) $resp->getBody(), true) ?: [];

    $byProperty = [];
    foreach ($rows as $row) {
        $prop = $row['propertyName'] ?? null;
        $value = $row['propertyValue'] ?? null;
        $count = (int) ($row['total'] ?? 0);
        if (!$prop || $value === null) continue;
        $byProperty[$prop][$value] = ($byProperty[$prop][$value] ?? 0) + $count;
    }
    return ['by_property' => $byProperty];
}

/**
 * Build per-domain stats from the cross-event histograms.
 *
 * Note: Umami's pre-aggregated histograms are independent per property,
 * so cross-property correlation isn't available -- "purchases from this
 * domain in this country" can't be computed from these rows alone. For
 * single-domain reporting (i.e. the digest we send to artist X is the
 * only domain reflected in their slice of activity), the global slice
 * IS the per-domain slice and the numbers are accurate. With multiple
 * artists running concurrently, country/promo/cost stats become
 * approximations -- worth revisiting if we add more domains.
 */
function build_domain_stats(array $aggregates, string $domain): array {
    $count = function (string $eventName) use ($aggregates, $domain) {
        return (int) ($aggregates[$eventName]['by_property']['referring_domain'][$domain] ?? 0);
    };

    $started   = $count('postcard_started');
    $verified  = $count('address_verified');
    $promo     = $count('promo_applied');
    $attempted = $count('payment_attempted');
    $completed = $count('purchase_completed');

    $purchaseProps = $aggregates['purchase_completed']['by_property'] ?? [];

    // Top promo code (across all completed purchases in the window)
    $promoCounts = $purchaseProps['promo_code'] ?? [];
    arsort($promoCounts);
    $topPromo = $promoCounts ? array_key_first($promoCounts) : null;

    // Country split on completed
    $countryCounts = $purchaseProps['country'] ?? [];

    // Revenue: sum of cost values weighted by their counts. Umami stores
    // numeric properties as decimal strings ("300.0000"); cost is in cents.
    $revenueCents = 0;
    foreach ($purchaseProps['cost'] ?? [] as $valueStr => $rowCount) {
        $revenueCents += (int) round((float) $valueStr) * $rowCount;
    }

    return [
        'postcard_started'   => $started,
        'address_verified'   => $verified,
        'promo_applied'      => $promo,
        'payment_attempted'  => $attempted,
        'purchase_completed' => $completed,
        'conversion_rate'    => $started > 0 ? round(100 * $completed / $started, 1) : 0,
        'top_promo'          => $topPromo,
        'top_promo_count'    => $topPromo ? $promoCounts[$topPromo] : 0,
        'country_split'      => $countryCounts,
        'revenue_cents'      => $revenueCents,
    ];
}

function generate_summary_with_claude(Client $client, string $apiKey, string $domain, array $stats, int $startTs, int $endTs): string {
    $startStr = date('M j, Y', $startTs);
    $endStr   = date('M j, Y', $endTs);

    $facts = "Site: $domain\n";
    $facts .= "Period: $startStr -- $endStr\n";
    $facts .= "Postcard makers started: {$stats['postcard_started']}\n";
    $facts .= "Addresses verified: {$stats['address_verified']}\n";
    $facts .= "Promos applied: {$stats['promo_applied']}\n";
    $facts .= "Payments attempted: {$stats['payment_attempted']}\n";
    $facts .= "Postcards completed: {$stats['purchase_completed']}\n";
    $facts .= "Conversion rate (started -> completed): {$stats['conversion_rate']}%\n";
    if ($stats['top_promo']) {
        $facts .= "Top promo code: {$stats['top_promo']} ({$stats['top_promo_count']} uses)\n";
    }
    if (!empty($stats['country_split'])) {
        $cs = [];
        foreach ($stats['country_split'] as $c => $n) $cs[] = "$c: $n";
        $facts .= "Recipient countries: " . implode(', ', $cs) . "\n";
    }
    if ($stats['revenue_cents']) {
        $facts .= "Gross revenue: \$" . number_format($stats['revenue_cents'] / 100, 2) . "\n";
    }

    $system = "You are writing a weekly analytics summary for an artist who uses Ollie Mail to ship "
            . "physical postcards of their generative artwork. Write ONE short paragraph (2-4 sentences) "
            . "addressed directly to the artist (\"you\", \"your visitors\"). Surface the single most "
            . "interesting signal from the data and skip the rest -- a stats table is rendered separately "
            . "below your text, so do NOT recite numbers. Tone: warm, low-key, no marketing copy or hype. "
            . "If activity is tiny, just acknowledge it without spinning. No exclamation points. End with "
            . "one short sentence pointing them to support@olliemail.net with questions. Output ONLY the "
            . "email body. No subject line, no signature, no greeting.";

    $payload = [
        'model'      => 'claude-haiku-4-5-20251001',
        'max_tokens' => 250,
        'system'     => $system,
        'messages'   => [
            ['role' => 'user', 'content' => "Stats:\n\n$facts"],
        ],
    ];

    try {
        $resp = $client->post('https://api.anthropic.com/v1/messages', [
            'headers' => [
                'x-api-key'         => $apiKey,
                'anthropic-version' => '2023-06-01',
                'Content-Type'      => 'application/json',
            ],
            'body' => json_encode($payload),
        ]);
    } catch (RequestException $e) {
        $body = $e->hasResponse() ? (string) $e->getResponse()->getBody() : '';
        throw new RuntimeException("Anthropic call failed: " . $e->getMessage() . " " . substr($body, 0, 300));
    }

    $data = json_decode((string) $resp->getBody(), true);
    $text = $data['content'][0]['text'] ?? null;
    if (!$text) throw new RuntimeException("Anthropic response missing text");
    return trim($text);
}

function send_digest_email(string $to, string $domain, string $bodyText, array $stats, int $startTs, int $endTs, ?string $intendedFor): void {
    $startStr = date('M j', $startTs);
    $endStr   = date('M j', $endTs);
    $subject  = "Your Ollie Mail digest for $domain ($startStr - $endStr)";

    $banner = '';
    if ($intendedFor) {
        $banner = "<div style='background:#fff3cd;border:1px solid #ffeaa7;padding:12px 16px;margin-bottom:20px;border-radius:4px;color:#856404;font-size:13px;'>"
                . "<strong>Dry-run preview.</strong> In production this email would have gone to "
                . htmlspecialchars($intendedFor) . "."
                . "</div>";
    }

    $bodyHtml = nl2br(htmlspecialchars($bodyText));

    $statsTable = "<table style='width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;'>"
                . row('Postcards started',   (string) $stats['postcard_started'])
                . row('Addresses verified',  (string) $stats['address_verified'])
                . row('Promos applied',      (string) $stats['promo_applied'])
                . row('Payments attempted',  (string) $stats['payment_attempted'])
                . row('Postcards completed', (string) $stats['purchase_completed'])
                . row('Conversion rate',     $stats['conversion_rate'] . '%')
                . ($stats['revenue_cents'] ? row('Gross revenue', '$' . number_format($stats['revenue_cents'] / 100, 2)) : '')
                . "</table>";

    $html = "
    <div style='max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;font-weight:300;line-height:1.6;color:#000;'>
        <div style='background:#000;color:#fff;padding:32px 20px;text-align:center;'>
            <h1 style='margin:0;font-size:24px;font-weight:400;'>Weekly digest</h1>
            <p style='margin:8px 0 0 0;font-size:14px;opacity:0.8;'>$domain &middot; $startStr&ndash;$endStr</p>
        </div>
        <div style='padding:24px 20px;'>
            $banner
            <div style='font-size:15px;'>$bodyHtml</div>
            $statsTable
            <p style='font-size:12px;color:#666;margin-top:32px;'>This summary is generated automatically each week from your olliemail activity. Reply to <a href='mailto:support@olliemail.net'>support@olliemail.net</a> with questions.</p>
        </div>
    </div>";

    $service = new MailchimpService();
    $tx = (new \MailchimpTransactional\ApiClient())->setApiKey($_ENV['MANDRILL_API_KEY']);
    $tx->messages->send(['message' => [
        'subject'    => $subject,
        'from_email' => 'do-not-reply@olliemail.net',
        'from_name'  => 'Ollie Mail',
        'to'         => [['email' => $to]],
        'html'       => $html,
    ]]);
}

function row(string $k, string $v): string {
    return "<tr><td style='padding:8px 12px;border-bottom:1px solid #eee;color:#666;'>$k</td><td style='padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:500;'>$v</td></tr>";
}
