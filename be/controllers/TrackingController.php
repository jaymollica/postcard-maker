<?php
use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;

class TrackingController
{
    /**
     * Fetch tracking info for a postcard. Public read-only endpoint -- the
     * postcard ID itself acts as the bearer token (16+ hex chars, infeasible
     * to brute-force). Returns a filtered subset of Lob's postcard record:
     * no street address, no email, just enough for a "where is my postcard"
     * page.
     *
     * @url POST /track
     */
    public function track_handler($data)
    {
        $postcard_id = isset($data->postcardId) ? trim((string) $data->postcardId) : '';

        if (!preg_match('/^psc_[a-zA-Z0-9]+$/', $postcard_id)) {
            http_response_code(400);
            return array('result' => 'error', 'message' => 'Invalid postcard ID');
        }

        $apiKey = $_ENV['LOB_API_KEY'];
        $client = new Client(array(
            'headers' => array('Authorization' => 'Basic ' . base64_encode($apiKey . ':')),
            'base_uri' => 'https://api.lob.com/v1/',
        ));

        try {
            $response = $client->get('postcards/' . $postcard_id);
            $postcard = json_decode($response->getBody(), true);
        } catch (RequestException $e) {
            $status = $e->hasResponse() ? $e->getResponse()->getStatusCode() : 500;
            http_response_code($status === 404 ? 404 : 502);
            return array('result' => 'error', 'message' => 'Postcard not found');
        }

        $to = $postcard['to'] ?? array();
        $thumbnails = $postcard['thumbnails'] ?? array();

        return array(
            'id' => $postcard['id'] ?? null,
            'date_created' => $postcard['date_created'] ?? null,
            'send_date' => $postcard['send_date'] ?? null,
            'expected_delivery_date' => $postcard['expected_delivery_date'] ?? null,
            'tracking_events' => $postcard['tracking_events'] ?? array(),
            // Recipient info -- name + city/state/country only. Street address
            // and email are intentionally not returned so a forwarded tracking
            // link doesn't leak them.
            'recipient' => array(
                'name' => $to['name'] ?? null,
                'city' => $to['address_city'] ?? null,
                'state' => $to['address_state'] ?? null,
                'country' => $to['address_country'] ?? null,
            ),
            'thumbnail' => $thumbnails[0]['large'] ?? ($thumbnails[0]['medium'] ?? null),
        );
    }
}
