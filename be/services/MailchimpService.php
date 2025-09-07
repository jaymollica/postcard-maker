<?php
require_once 'vendor/autoload.php';

use MailchimpTransactional\ApiClient;
use DrewM\MailChimp\MailChimp;

class MailchimpService {
    private $transactional;
    private $marketing;
    
    public function __construct() {
        // Initialize Mandrill for transactional emails
        $this->transactional = new ApiClient();
        $this->transactional->setApiKey($_ENV['MANDRILL_API_KEY']);
        
        // Initialize Mailchimp for audience management
        $this->marketing = new MailChimp($_ENV['MAILCHIMP_API_KEY']);
    }
    
    public function sendPostcardReceipt($postcardData, $senderData, $lobData) {
        try {
            // Send transactional email
            $emailResult = $this->sendTransactionalEmail($postcardData, $senderData, $lobData);
            
            // Add to audience
            $audienceResult = $this->addToAudience($senderData);
            
            return [
                'email_sent' => $emailResult,
                'added_to_audience' => $audienceResult
            ];
        } catch (Exception $e) {
            error_log('Mailchimp service error: ' . $e->getMessage());
            return [
                'error' => 'Failed to send email or add to audience',
                'message' => $e->getMessage()
            ];
        }
    }
    
    private function sendTransactionalEmail($postcardData, $senderData, $lobData) {
    $deliveryEstimate = $this->calculateDeliveryEstimate($lobData['date_created']);
    
    $messageData = [
        'subject' => 'Your CC0 Postcard Receipt & Tracking 📮',
        'from_email' => 'do-not-reply@sweetpost.art',
        'from_name' => 'CC0 Postcards',
        'to' => [[
            'email' => $senderData['email'],
            'name' => $senderData['name'] ?? ''
        ]],
        'global_merge_vars' => [
            ['name' => 'SENDER_NAME', 'content' => $senderData['name'] ?? ''],
            ['name' => 'POSTCARD_IMAGE', 'content' => $postcardData['front_image'] ?? ''],
            ['name' => 'TRACKING_URL', 'content' => $lobData['url'] ?? ''],
            ['name' => 'DELIVERY_DATE', 'content' => $deliveryEstimate],
            ['name' => 'COST', 'content' => '$' . number_format(($lobData['cost'] ?? 80) / 100, 2)],
            ['name' => 'ARTWORK_TITLE', 'content' => $postcardData['artworkTitle'] ?? ''],
            ['name' => 'ARTWORK_ARTIST', 'content' => $postcardData['artworkArtist'] ?? ''],
            ['name' => 'ARTWORK_MUSEUM', 'content' => $postcardData['artworkMuseum'] ?? '']
        ],
        'template_name' => 'postcard-receipt-1',
        'template_content' => []
    ];

    // Write to a file we can easily check
    $debugFile = '/tmp/mandrill_debug.log';
    file_put_contents($debugFile, "\n=== " . date('Y-m-d H:i:s') . " ===\n", FILE_APPEND);
    file_put_contents($debugFile, "Email to: " . $senderData['email'] . "\n", FILE_APPEND);
    file_put_contents($debugFile, "Template: postcard-receipt-1\n", FILE_APPEND);
    file_put_contents($debugFile, "Merge vars: " . json_encode($messageData['global_merge_vars'], JSON_PRETTY_PRINT) . "\n", FILE_APPEND);
    
    
    // Debug logging
    error_log('=== MANDRILL DEBUG ===');
    error_log('Template: postcard-receipt-1');
    error_log('To: ' . $senderData['email']);
    error_log('Merge vars: ' . json_encode($messageData['global_merge_vars']));
    
    try {
        $result = $this->transactional->messages->send(['message' => $messageData]);
        error_log('Mandrill result: ' . json_encode($result));
        return $result;
    } catch (Exception $e) {
        error_log('Mandrill error: ' . $e->getMessage());
        throw $e;
    }
}
    
    private function addToAudience($senderData) {
        return $this->marketing->post("lists/" . $_ENV['MAILCHIMP_AUDIENCE_ID'] . "/members", [
            'email_address' => $senderData['email'],
            'status' => 'subscribed',
            'merge_fields' => [
                'FNAME' => $senderData['first_name'] ?? '',
                'LNAME' => $senderData['last_name'] ?? ''
            ],
            'tags' => ['postcard-sender', 'cc0-postcards']
        ]);
    }
    
    private function calculateDeliveryEstimate($sendDateString) {
        $sendDate = new DateTime($sendDateString);
        $businessDays = 4; // Conservative estimate
        
        $deliveryDate = clone $sendDate;
        $added = 0;
        
        while ($added < $businessDays) {
            $deliveryDate->add(new DateInterval('P1D'));
            if ($deliveryDate->format('N') < 6) { // Monday = 1, Sunday = 7
                $added++;
            }
        }
        
        return $deliveryDate->format('F j, Y');
    }
}