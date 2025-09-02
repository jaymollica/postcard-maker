<?php
use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
class LobController
{
    /**
     * Returns a JSON string object to the browser when hitting the root of the domain
     *
     * @url POST /lob
     */
    public function lob_handler($data)
    {
        error_log(var_export('data', true));
        error_log(var_export($data, true));

        
        if (!verify_nonce($data->nonce, $_ENV['NONCE_ACTION'])) {
            http_response_code(500);
            return array('result' => 'error', 'message' => 'Bad nonce');
        }

        $mp = Mixpanel::getInstance("7314411302a0eb71f9a2c69c8371f36f");
        
        $stripe = new \Stripe\StripeClient($_ENV['STRIPE_API_KEY']);

        if( $data->paymentIntent !== null ){

            $payment_intent_id = $data->paymentIntent->id;

            try {
                $payment_intent = $stripe->paymentIntents->retrieve($payment_intent_id);
                
                global $default_cost;
                if( isset($data->promo->active) && $data->promo->active ){
            
                    if( $data->promo->coupon->percent_off !== null ){
                      $new_cost = $default_cost - ($default_cost * ($data->promo->coupon->percent_off / 100));
                    }
                    else if( $data->promo->coupon->amount_off !== null ){
                      $new_cost = $default_cost - $data->promo->coupon->amount_off;
                    }
        
                    if( $new_cost < 0 ){
                      $new_cost = 0;
                    }
                }
                // Check if the payment intent has succeeded or if it's a sorta free item
                if ($payment_intent->status === 'succeeded' || $new_cost < 50) {
                    
                    $merge_variables = $data->merge_variables ?? (object) array();

                    // Add artwork metadata to merge variables  
                    if (isset($data->artworkTitle)) {
                        $merge_variables->artworkTitle = $data->artworkTitle;
                    }
                    if (isset($data->artworkArtist)) {
                        $merge_variables->artworkArtist = $data->artworkArtist;
                    }
                    if (isset($data->artworkYear)) {
                        $merge_variables->artworkYear = $data->artworkYear;
                    }
                    if (isset($data->artworkMuseum)) {
                        $merge_variables->artworkMuseum = $data->artworkMuseum;
                    }
                    if (isset($data->objectId)) {
                        $merge_variables->objectId = $data->objectId;
                    }
                    if (isset($data->userMessage) && !empty(trim($data->userMessage))) {
                        $merge_variables->userMessage = trim($data->userMessage);
                    }

                    // Add museum code for URL generation
                    $museumCodeMap = [
                        'Cleveland Museum of Art' => 'cleveland',
                        'Metropolitan Museum of Art' => 'met'
                    ];
                    if (isset($data->artworkMuseum) && isset($museumCodeMap[$data->artworkMuseum])) {
                        $merge_variables->museumCode = $museumCodeMap[$data->artworkMuseum];
                    }

                    // Replace YOUR_API_KEY with your actual API key.
                    $apiKey = $_ENV['LOB_API_KEY'];

                    $authHeaderValue = 'Basic ' . base64_encode($apiKey . ':');
                    $client = new Client(array(
                        'headers' => ['Authorization' => $authHeaderValue],
                        'base_uri' => 'https://api.lob.com/v1/',
                    ));

                    global $domain_template_map;
                    $domain_vars = $domain_template_map[array_search($data->artistUrl, array_column($domain_template_map, 'url'))];
                    $front = $domain_vars->front_template ?? $_ENV['LOB_FRONT_TEMPLATE_DEFAULT'];
                    $back = $domain_vars->back_template ?? $_ENV['LOB_BACK_TEMPLATE_DEFAULT'];

                    

                    $recipient = array(
                        "name"     =>  $data->to->name ?? '',
                        "address_line1"     => $data->to->line1 ?? '',
                        "address_line2"     => $data->to->line2 ?? '',
                        "address_city"     => $data->to->city ?? '',
                        "address_state"     => $data->to->state ?? '',
                        "address_zip"     => $data->to->postal_code ?? '',
                        'address_country' => 'US',
                    );

                    try {
                        $form_params = array(
                            'description' => 'Example Postcard',
                            'to[name]' => $recipient['name'],
                            'to[address_line1]' => $recipient['address_line1'],
                            'to[address_city]' => $recipient['address_city'],
                            'to[address_state]' => $recipient['address_state'],
                            'to[address_zip]' => $recipient['address_zip'],
                            'to[address_country]' => $recipient['address_country'],
                            'to[email]' => $data->email ?? '',
                            'front' => $front,
                            'back' => $back,
                            'use_type' => 'marketing',
                        );
                        
                        foreach( $merge_variables as $key => $value ){
                            $form_params["merge_variables[$key]"] = $value;
                        }
                        
                        $response = $client->post('postcards', array(
                            'form_params' => $form_params,
                        ));

                        $result = json_decode($response->getBody(), true);

                        // send mixpanel on success
                        $mp->track('Purchase', array(
                            'project' => $domain_vars->url,
                            'cost' => $data->cost,
                            'promo' => $data->promo,
                        ));
                        
                        return $result;
                    } catch (RequestException $e) {
                        return array('result' => 'error', 'message' => $e->getResponse()->getBody());
                    }

                } else {
                    return array('result' => 'error', 'message' => 'Error... Payment intent status: ' . $payment_intent->status);
                }

            } catch (\Stripe\Exception\ApiErrorException $e) {
                // Handle errors when retrieving the payment intent
                return array('result' => 'error', 'message' => 'Error retrieving payment intent: ' . $e->getMessage());
            }
        }
        else{
            // Handle errors when retrieving the payment intent
            return array('result' => 'error', 'message' => 'Stop screwing around!');
        }
       

        

    }
}
