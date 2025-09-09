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
        error_log('=== MAILCHIMP SERVICE DEBUG ===');
        error_log('Received lobData: ' . json_encode($lobData));
        error_log('Received senderData: ' . json_encode($senderData));
        error_log('Received postcardData: ' . json_encode($postcardData));
        
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

        // Get payment intent ID
        $paymentIntentId = $lobData['payment_intent_id'] ?? 'N/A';
        $postcardId = $lobData['id'] ?? 'N/A';
        
        error_log('Payment Intent ID extracted: ' . $paymentIntentId);
        error_log('Postcard ID: ' . $postcardId);
        
        // Build tracking URL - try multiple approaches
        $trackingUrl = '#'; // Default fallback
        
        // First, try to use the tracking_url from Lob API if available
        if (isset($lobData['tracking_url']) && !empty($lobData['tracking_url'])) {
            $trackingUrl = $lobData['tracking_url'];
            error_log('Using Lob provided tracking URL: ' . $trackingUrl);
        } 
        // If no tracking_url, try to construct one using the tracking_events URL pattern
        else if (isset($lobData['tracking_events']) && !empty($postcardId) && $postcardId !== 'N/A') {
            $trackingUrl = "https://dashboard.lob.com/#/postcards/{$postcardId}";
            error_log('Constructed dashboard tracking URL: ' . $trackingUrl);
        }
        // Last resort - use a generic tracking page if postcard ID exists
        else if (!empty($postcardId) && $postcardId !== 'N/A') {
            $trackingUrl = "https://lob.com/resources/guides/tracking";
            error_log('Using generic tracking guide URL: ' . $trackingUrl);
        }
        
        error_log('Final tracking URL: ' . $trackingUrl);
        error_log('PDF URL: ' . ($lobData['url'] ?? 'MISSING'));

        // Build inline HTML with both IDs clearly displayed
        $htmlContent = "
        <div style='max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;'>
            <div style='background: #0078d4; color: white; padding: 40px 20px; text-align: center;'>
                <h1>Your Postcard is on its way!</h1>
                <p>Thanks for using CC0 Postcards</p>
            </div>
            <div style='padding: 20px;'>
                <div style='background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; padding: 16px; margin-bottom: 20px;'>
                    <p style='margin: 0 0 8px 0; font-weight: bold;'>Order References:</p>
                    <p style='margin: 0 0 4px 0;'><strong>Postcard ID:</strong> " . htmlspecialchars($postcardId) . "</p>
                    <p style='margin: 0;'><strong>Payment Reference:</strong> " . htmlspecialchars($paymentIntentId) . "</p>
                </div>
                <p><strong>Cost:</strong> " . $costDisplay . "</p>
                <p><strong>Estimated Delivery:</strong> " . $deliveryEstimate . "</p>
                <div style='margin: 20px 0;'>
                    <a href='" . htmlspecialchars($lobData['url'] ?? '#') . "' style='display: inline-block; background: #0078d4; color: white; padding: 10px 20px; text-decoration: none; margin-right: 10px; border-radius: 4px;'>View Postcard PDF</a>
                </div>
                <div style='margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;'>
                    <p><strong>Need help?</strong></p>
                    <ul style='margin: 5px 0; padding-left: 20px;'>
                        <li>For questions about the service email <strong><a href='mailto:support@sweetpost.art'>support@sweetpost.art</a></strong></li>
                        <li>For refunds or billing issues, reference: <strong>" . htmlspecialchars($paymentIntentId) . "</strong></li>
                        <li>For delivery issues, reference: <strong>" . htmlspecialchars($postcardId) . "</strong></li>
                    </ul>
                </div>
            </div>
        </div>";
        
        error_log('Generated HTML content length: ' . strlen($htmlContent));
        error_log('=== END MAILCHIMP DEBUG ===');

        $messageData = [
            'subject' => 'Your CC0 Postcard Receipt & Tracking 📮',
            'from_email' => 'do-not-reply@sweetpost.art',
            'from_name' => 'CC0 Postcards',
            'to' => [[
                'email' => $senderData['email'],
                'name' => $senderData['name'] ?? ''
            ]],
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