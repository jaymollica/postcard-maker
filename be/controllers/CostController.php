<?php

use \Jacwright\RestServer\RestException;

class CostController
{
    /**
     * Returns domain-specific cost
     *
     * @url POST /cost
     */
    public function cost_handler($data){
        if( !verify_nonce($data->nonce, $_ENV['NONCE_ACTION']) ){
            http_response_code(403);
            return ['result' => 'error', 'message' => 'Invalid request'];
        }

        try {
            // Get country from request or default to US
            $country = $data->country ?? 'US';

            // Get domain-specific cost based on country
            $cost = get_cost_for_domain($data->artistUrl ?? get_origin(), $country);

            return [
                'result' => 'success',
                'cost' => $cost,
                'domain' => $data->artistUrl ?? get_origin(),
                'country' => $country
            ];
        } catch (\Exception $ex) {
            if ($_ENV['APP_ENV'] === 'development') {
                error_log('Cost handler error: ' . $ex->getMessage());
            }
            http_response_code(500);
            return ['result' => 'error', 'message' => 'Unable to retrieve pricing'];
        }
    }
}