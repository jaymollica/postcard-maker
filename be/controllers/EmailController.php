<?php
use \Jacwright\RestServer\RestException;

class EmailController {
    /**
     * Send postcard receipt email
     *
     * @url POST /email/receipt
     */
    public function sendReceipt($data) {
        if (!verify_nonce($data->nonce, $_ENV['NONCE_ACTION'])) {
            http_response_code(500);
            return ['result' => 'error', 'message' => 'Bad nonce'];
        }
        
        try {
            require_once './services/MailchimpService.php';
            $mailchimpService = new MailchimpService();
            
            $result = $mailchimpService->sendPostcardReceipt(
                $data->postcardData ?? [],
                $data->senderData ?? [],
                $data->lobData ?? []
            );
            
            return ['result' => 'success', 'data' => $result];
        } catch (Exception $e) {
            error_log('Email controller error: ' . $e->getMessage());
            http_response_code(500);
            return ['result' => 'error', 'message' => $e->getMessage()];
        }
    }
}