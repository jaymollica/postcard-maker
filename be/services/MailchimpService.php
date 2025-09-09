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
        
        // Calculate actual cost paid (after promo codes)
        $originalCost = 80; // default cost in cents
        $actualCost = $lobData['cost'] ?? $originalCost;
        $promoApplied = $actualCost < $originalCost;
        
        // Build cost display
        $costDisplay = '$' . number_format($actualCost / 100, 2);
        if ($promoApplied) {
            $savings = $originalCost - $actualCost;
            $costDisplay .= ' <span style="color: #28a745;">(Promo applied - saved $' . number_format($savings / 100, 2) . ')</span>';
        }

        // Build inline HTML instead of using template
        $htmlContent = "
        <div style='max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;'>
            <div style='background: #0078d4; color: white; padding: 40px 20px; text-align: center;'>
                <h1>Your Postcard is on its way!</h1>
                <p>Thanks for using CC0 Postcards, " . ($senderData['name'] ?? '') . "</p>
            </div>
            <div style='padding: 20px;'>
                <p><strong>Order ID:</strong> " . ($lobData['id'] ?? 'N/A') . "</p>
                <p><strong>Cost:</strong> " . $costDisplay . "</p>
                <p><strong>Estimated Delivery:</strong> " . $deliveryEstimate . "</p>
                <div style='margin: 20px 0;'>
                    <a href='" . ($lobData['url'] ?? '#') . "' style='display: inline-block; background: #0078d4; color: white; padding: 10px 20px; text-decoration: none; margin-right: 10px; border-radius: 4px;'>View Postcard</a>
                    <a href='" . ($lobData['tracking_url'] ?? '#') . "' style='display: inline-block; background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;'>Track Your Postcard</a>
                </div>
            </div>
        </div>";

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
                ['name' => 'PDF_URL', 'content' => $lobData['url'] ?? ''],
                ['name' => 'TRACKING_URL', 'content' => $lobData['tracking_url'] ?? ''],
                ['name' => 'DELIVERY_DATE', 'content' => $deliveryEstimate],
                ['name' => 'COST_DISPLAY', 'content' => $costDisplay],
                ['name' => 'POSTCARD_ID', 'content' => $lobData['id'] ?? 'N/A'],
                ['name' => 'PAYMENT_ID', 'content' => $lobData['payment_intent_id'] ?? 'N/A'],
                ['name' => 'ARTWORK_TITLE', 'content' => $postcardData['artworkTitle'] ?? ''],
                ['name' => 'ARTWORK_ARTIST', 'content' => $postcardData['artworkArtist'] ?? ''],
                ['name' => 'ARTWORK_MUSEUM', 'content' => $postcardData['artworkMuseum'] ?? '']
            ],
            'html' => $htmlContent,
        ];
        
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