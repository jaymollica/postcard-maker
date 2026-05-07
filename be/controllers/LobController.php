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
        if (!verify_nonce($data->nonce, $_ENV['NONCE_ACTION'])) {
            http_response_code(403);
            return array('result' => 'error', 'message' => 'Invalid request');
        }

        $mp = Mixpanel::getInstance($_ENV['MIXPANEL_KEY']);
        
        $stripe = new \Stripe\StripeClient($_ENV['STRIPE_API_KEY']);

        if( $data->paymentIntent !== null ){

            $payment_intent_id = $data->paymentIntent->id;

            try {
                $payment_intent = $stripe->paymentIntents->retrieve($payment_intent_id);

                // Get country from address data
                $country = $data->to->country ?? 'US';

                // Source of truth is the PaymentIntent, not the request body.
                // promo_handler writes promotion_code_id + original_amount +
                // discounted_amount into metadata only after server-side Stripe
                // validation, so trusting metadata here is safe; trusting
                // $data->promo is not.
                $promo_applied = !empty($payment_intent->metadata['promotion_code_id']);
                // Stripe won't let us update PI amount below $0.50, so for
                // fully-discounted orders the true charge lives in metadata.
                $actual_cost = $promo_applied && isset($payment_intent->metadata['discounted_amount'])
                    ? (int) $payment_intent->metadata['discounted_amount']
                    : (int) $payment_intent->amount;
                $default_cost = isset($payment_intent->metadata['original_amount'])
                    ? (int) $payment_intent->metadata['original_amount']
                    : get_cost_for_domain($data->artistUrl, $country);

                // Stripe rejects sub-$0.50 charges, so a fully-discounted order
                // can never reach status=succeeded. Allow shipping in that case
                // ONLY if a real promo was server-validated on the PaymentIntent.
                $is_free_with_promo = ($actual_cost < 50 && $promo_applied);

                if ($payment_intent->status === 'succeeded' || $is_free_with_promo) {
                    
                    $merge_variables = $data->merge_variables ?? (object) array();

                    // Check merge_variables for properties, not $data directly
                    // Set default values for footer variables if not provided
                    if (!property_exists($merge_variables, 'footerHeader') || empty($merge_variables->footerHeader)) {
                        $merge_variables->footerHeader = 'About This Postcard';
                    }
                    
                    if (!property_exists($merge_variables, 'footerMessage') || empty($merge_variables->footerMessage)) {
                        $merge_variables->footerMessage = 'This postcard features artwork from a public domain collection.';
                    }
                    
                    if (!property_exists($merge_variables, 'footerUrl') || empty($merge_variables->footerUrl)) {
                        $merge_variables->footerUrl = 'Make your own at www.sweetpost.art';
                    }

                    if (!property_exists($merge_variables, 'qrCodeUrl') || empty($merge_variables->qrCodeUrl)) {
                        $merge_variables->qrCodeUrl = 'https://www.sweetpost.art';
                    }

                    // Country name for printing on the postcard. Lob's auto-
                    // rendered address block omits the country line for
                    // international mail, so expose the country as a merge
                    // variable the back template can render manually. Empty
                    // string for US so the line collapses on domestic mail.
                    $merge_variables->recipientCountryLine = country_name_for_code($country);

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

                    // Tag the PaymentIntent with the originating artist domain
                    // so orders are separable per-domain in the Stripe dashboard.
                    // Prefer the slug encoded into the imgUrl by AWSController
                    // (Referer-verified at upload time); fall back to the
                    // unverified $data->artistUrl for legacy uploads. Non-fatal.
                    $imgurl = $data->merge_variables->artworkImageURL ?? '';
                    $verified_domain = get_domain_from_imgurl($imgurl);
                    $referring_domain = $verified_domain
                        ?? ($domain_vars->domain ?? get_domain_for_url($data->artistUrl));
                    try {
                        $stripe->paymentIntents->update($payment_intent_id, array(
                            'description' => 'SweetPost postcard via ' . $referring_domain,
                            'metadata' => array(
                                'referring_domain' => $referring_domain,
                                'referring_domain_verified' => $verified_domain ? 'true' : 'false',
                            ),
                        ));
                    } catch (\Stripe\Exception\ApiErrorException $e) {
                        if ($_ENV['APP_ENV'] === 'development') {
                            error_log('PI domain-tag failed: ' . $e->getMessage());
                        }
                    }

                    $recipient = array(
                        "name"     =>  $data->to->name ?? '',
                        "address_line1"     => $data->to->line1 ?? '',
                        "address_line2"     => $data->to->line2 ?? '',
                        "address_city"     => $data->to->city ?? '',
                        "address_state"     => $data->to->state ?? '',
                        "address_zip"     => $data->to->postal_code ?? '',
                        'address_country' => $country,
                    );

                    try {
                        $form_params = array(
                            'description' => 'Example Postcard',
                            'to[name]' => $recipient['name'],
                            'to[address_line1]' => $recipient['address_line1'],
                            'to[address_line2]' => $recipient['address_line2'],
                            'to[address_city]' => $recipient['address_city'],
                            'to[address_state]' => $recipient['address_state'],
                            'to[address_zip]' => $recipient['address_zip'],
                            'to[address_country]' => $recipient['address_country'],
                            'to[email]' => $data->email ?? '',
                            'front' => $front,
                            'back' => $back,
                            'use_type' => 'marketing',
                        );

                        // Add return address for international mail
                        if (strtoupper($country) !== 'US') {
                            $form_params['from[name]'] = $_ENV['LOB_RETURN_NAME'] ?? 'SweetPost';
                            $form_params['from[address_line1]'] = $_ENV['LOB_RETURN_ADDRESS_LINE1'] ?? '';
                            $form_params['from[address_line2]'] = $_ENV['LOB_RETURN_ADDRESS_LINE2'] ?? '';
                            $form_params['from[address_city]'] = $_ENV['LOB_RETURN_CITY'] ?? '';
                            $form_params['from[address_state]'] = $_ENV['LOB_RETURN_STATE'] ?? '';
                            $form_params['from[address_zip]'] = $_ENV['LOB_RETURN_ZIP'] ?? '';
                            $form_params['from[address_country]'] = 'US';
                        }
                        
                        foreach( $merge_variables as $key => $value ){
                            $form_params["merge_variables[$key]"] = $value;
                        }
                        
                        $response = $client->post('postcards', array(
                            'form_params' => $form_params,
                        ));

                        $result = json_decode($response->getBody(), true);

                        try {
                            require_once __DIR__ . '/../services/MailchimpService.php';
                            $mailchimpService = new MailchimpService();
                            
                            // Extract data correctly from the frontend structure
                            $postcardData = [
                                'front_image' => $data->merge_variables->artworkImageURL ?? '',
                                'artworkTitle' => $data->merge_variables->artworkTitle ?? '',
                                'artworkArtist' => $data->merge_variables->artworkArtist ?? '',
                                'artworkYear' => $data->merge_variables->artworkYear ?? '',
                                'artworkMuseum' => $data->merge_variables->artworkMuseum ?? '',
                                'userMessage' => $data->merge_variables->userMessage ?? '',
                                'footerHeader' => $data->merge_variables->footerHeader ?? '',
                                'footerMessage' => $data->merge_variables->footerMessage ?? '',
                                'footerUrl' => $data->merge_variables->footerUrl ?? '',
                                'qrCodeUrl' => $data->merge_variables->qrCodeUrl ?? '',
                            ];
                            
                            $senderData = [
                                'email' => $data->to->email ?? '', 
                                'name' => $data->to->name ?? '',
                                'first_name' => explode(' ', $data->to->name ?? '')[0] ?? '',
                                'last_name' => explode(' ', $data->to->name ?? '')[1] ?? ''
                            ];

                            // Add the actual cost, payment intent ID, and original cost to the Lob result
                            $result['cost'] = $actual_cost;
                            $result['payment_intent_id'] = $payment_intent_id;
                            $result['original_cost'] = $default_cost; // Pass domain-specific original cost

                            $emailResult = $mailchimpService->sendPostcardReceipt(
                                $postcardData,
                                $senderData,
                                $result
                            );
                            
                            // Only add to result if email was successful
                            if (!isset($emailResult['error'])) {
                                $result['email_receipt'] = $emailResult;
                            }
                        } catch (Exception $e) {
                            // Log error but don't crash the response
                            if ($_ENV['APP_ENV'] === 'development') {
                                error_log('Email sending failed: ' . $e->getMessage());
                            }
                            // Don't add anything to $result so the main response stays intact
                        }

                        // send mixpanel on success
                        $mp->track('Purchase', array(
                            'project' => $domain_vars->url,
                            'cost' => $actual_cost, // Use actual cost for analytics too
                            'original_cost' => $default_cost, // Track original domain cost for analytics
                            'promo' => $data->promo,
                        ));
                        
                        return $result;
                    } catch (RequestException $e) {
                        if ($_ENV['APP_ENV'] === 'development') {
                            error_log('Lob API error: ' . $e->getResponse()->getBody());
                        }
                        return array('result' => 'error', 'message' => 'Failed to create postcard');
                    }

                } else {
                    if ($_ENV['APP_ENV'] === 'development') {
                        error_log('Payment not completed: ' . $payment_intent->status);
                    }
                    return array('result' => 'error', 'message' => 'Payment verification failed');
                }

            } catch (\Stripe\Exception\ApiErrorException $e) {
                if ($_ENV['APP_ENV'] === 'development') {
                    error_log('Stripe API error: ' . $e->getMessage());
                }
                return array('result' => 'error', 'message' => 'Payment verification failed');
            }
        }
        else{
            return array('result' => 'error', 'message' => 'Invalid request');
        }
    }
}