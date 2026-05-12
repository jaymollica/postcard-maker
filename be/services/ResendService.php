<?php
require_once 'vendor/autoload.php';

// Transactional + audience replacement for the old MailchimpService.
// Resend handles both: emails->send for transactional, contacts->create
// against an audience_id for the marketing list.
class ResendService {
    private $client;
    private $audienceId;
    private $fromAddress;

    public function __construct() {
        $apiKey = $_ENV['RESEND_API_KEY'] ?? '';
        if (!$apiKey) {
            throw new RuntimeException('RESEND_API_KEY not set');
        }
        $this->client = Resend::client($apiKey);
        $this->audienceId = $_ENV['RESEND_AUDIENCE_ID'] ?? '';
        $this->fromAddress = $_ENV['RESEND_FROM'] ?? 'Ollie Mail <do-not-reply@olliemail.net>';
    }

    public function sendPostcardReceipt($postcardData, $senderData, $lobData) {
        try {
            $emailResult = $this->sendTransactionalEmail($postcardData, $senderData, $lobData);
            $audienceResult = $this->addToAudience($senderData);

            return [
                'email_sent' => $emailResult,
                'added_to_audience' => $audienceResult,
            ];
        } catch (Exception $e) {
            error_log('ResendService error: ' . $e->getMessage());
            return [
                'error' => 'Failed to send email or add to audience',
                'message' => $e->getMessage(),
            ];
        }
    }

    // Generic transactional sender — used by the weekly digest script.
    public function sendEmail($to, $subject, $html, $extra = []) {
        $payload = array_merge([
            'from' => $this->fromAddress,
            'to' => is_array($to) ? $to : [$to],
            'subject' => $subject,
            'html' => $html,
        ], $extra);
        return $this->client->emails->send($payload);
    }

    private function sendTransactionalEmail($postcardData, $senderData, $lobData) {
        $deliveryEstimate = $this->calculateDeliveryEstimate($lobData['date_created']);

        // Cost paid, accounting for promo codes that may have lowered it.
        $originalCost = $lobData['original_cost'] ?? 80;
        $actualCost = $lobData['cost'] ?? $originalCost;
        $promoApplied = $actualCost < $originalCost;

        $costDisplay = '$' . number_format($actualCost / 100, 2);
        if ($promoApplied) {
            $savings = $originalCost - $actualCost;
            $costDisplay .= ' <span style="color: #28a745;">(Promo applied - saved $' . number_format($savings / 100, 2) . ')</span>';
        }

        $paymentIntentId = $lobData['payment_intent_id'] ?? 'N/A';
        $postcardId = $lobData['id'] ?? 'N/A';

        // Tracking URL points at our own /?track=<postcardId> route on the
        // React frontend, which fetches from /track and shows progress.
        $frontendUrl = $_ENV['FRONTEND_URL'] ?? 'https://olliemail.net';
        $trackingUrl = (!empty($postcardId) && $postcardId !== 'N/A')
            ? rtrim($frontendUrl, '/') . '/?track=' . urlencode($postcardId)
            : '#';

        $htmlContent = "
        <div style='max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;'>
            <div style='background: #0078d4; color: white; padding: 40px 20px; text-align: center;'>
                <h1>Your postcard is on its way!</h1>
                <p>Thanks for using Ollie Mail</p>
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
                    <a href='" . htmlspecialchars($trackingUrl) . "' style='display: inline-block; background: #fff; color: #0078d4; border: 1px solid #0078d4; padding: 10px 20px; text-decoration: none; border-radius: 4px;'>Track your postcard</a>
                </div>
                <div style='margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;'>
                    <p><strong>Need help?</strong></p>
                    <ul style='margin: 5px 0; padding-left: 20px;'>
                        <li>For questions about the service email <strong><a href='mailto:support@olliemail.net'>support@olliemail.net</a></strong></li>
                        <li>For refunds or billing issues, reference: <strong>" . htmlspecialchars($paymentIntentId) . "</strong></li>
                        <li>For delivery issues, reference: <strong>" . htmlspecialchars($postcardId) . "</strong></li>
                    </ul>
                </div>
            </div>
        </div>";

        $result = $this->client->emails->send([
            'from' => $this->fromAddress,
            'to' => [$senderData['email']],
            'subject' => 'Your Postcard Receipt & Tracking 📮',
            'html' => $htmlContent,
        ]);
        return $result;
    }

    private function addToAudience($senderData) {
        if (!$this->audienceId) {
            return ['skipped' => 'RESEND_AUDIENCE_ID not configured'];
        }
        if (empty($senderData['email'])) {
            return ['skipped' => 'no email provided'];
        }
        try {
            return $this->client->contacts->create([
                'email' => $senderData['email'],
                'first_name' => $senderData['first_name'] ?? '',
                'last_name' => $senderData['last_name'] ?? '',
                'unsubscribed' => false,
                'audience_id' => $this->audienceId,
            ]);
        } catch (Exception $e) {
            // Resend returns 409 if contact already exists in the audience.
            // Don't fail the whole flow on that; just log and move on.
            error_log('ResendService addToAudience non-fatal: ' . $e->getMessage());
            return ['error' => $e->getMessage()];
        }
    }

    private function calculateDeliveryEstimate($sendDateString) {
        $sendDate = new DateTime($sendDateString);
        $businessDays = 4;

        $deliveryDate = clone $sendDate;
        $added = 0;

        while ($added < $businessDays) {
            $deliveryDate->add(new DateInterval('P1D'));
            if ($deliveryDate->format('N') < 6) {
                $added++;
            }
        }

        return $deliveryDate->format('F j, Y');
    }
}
