<?php

use \Jacwright\RestServer\RestException;

class StripeController
{
    /**
     * Returns stripe promo code response
     *
     * @url POST /promo
     */
    public function promo_handler($data){
      if( !verify_nonce($data->nonce, $_ENV['NONCE_ACTION']) ){
        http_response_code(403);
        return ['result' => 'error', 'message' => 'Invalid request'];
      }

      if( empty($data->promo) ){
        http_response_code(400);
        return ['result' => 'error', 'message' => 'Promo code is required'];
      }

      $stripe = new \Stripe\StripeClient($_ENV['STRIPE_API_KEY']);

      try {
        // Get country from address data
        $country = $data->country ?? 'US';

        // Get domain-specific cost based on country
        $default_cost = get_cost_for_domain($data->artistUrl ?? get_origin(), $country);

        $promos = $stripe->promotionCodes->all(array(
          'active' => true,
          'code' => $data->promo
        ));

        if( count($promos->data) > 0 ){

          // always return the first promo
          $promo = $promos->data[0];

          if( $promo->active ){
            // In Stripe SDK v19, coupon ID is nested under promotion->coupon
            $coupon_id = $promo->promotion->coupon ?? null;

            if (!$coupon_id) {
              return ['result' => 'error', 'message' => 'Invalid promo code'];
            }

            $coupon = $stripe->coupons->retrieve($coupon_id);

            if( $coupon->percent_off !== null ){
              $new_cost = $default_cost - ($default_cost * ($coupon->percent_off / 100));
            }
            else if( $coupon->amount_off !== null ){
              $new_cost = $default_cost - $coupon->amount_off;
            }

            if( $new_cost < 0 ){
              $new_cost = 0;
            }

            // Persist the promo on the PaymentIntent's metadata so LobController
            // can server-trust the discount when shipping a sub-$0.50 (free) order.
            // Stripe rejects amount updates below $0.50, so in that case we leave
            // the existing amount in place and rely on metadata.discounted_amount.
            // Artist domain tagging is intentionally NOT done here -- LobController
            // sets it from a Referer-verified S3 key slug, which is trustworthy.
            $update_params = array(
              'metadata' => array(
                'promotion_code_id' => $promo->id,
                'coupon_code' => $promo->code ?? '',
                'original_amount' => $default_cost,
                'discounted_amount' => $new_cost,
              ),
            );
            if( $new_cost >= 50 ){
              $update_params['amount'] = $new_cost;
            }
            $stripe->paymentIntents->update($data->paymentIntent->id, $update_params);
          }

          // Return promo with coupon data attached for frontend compatibility
          // Frontend expects coupon to be a direct property (old Stripe API structure)
          $response = json_decode(json_encode($promo), true); // Convert to array
          $response['coupon'] = json_decode(json_encode($coupon), true); // Add coupon data
          return $response;
        }
        else{
          return ['result' => 'error', 'message' => 'No promo code ' . $data->promo];
        }

      } catch (\Exception $ex) {
        if ($_ENV['APP_ENV'] === 'development') {
          error_log('Promo handler error: ' . $ex->getMessage());
        }
        http_response_code(500);
        return ['result' => 'error', 'message' => 'Unable to process promo code'];
      }
    }

    /**
     * Returns a JSON string object to the browser when hitting the root of the domain
     *
     * @url POST /stripe
     */
    public function pay_handler($data){

      if( !verify_nonce($data->nonce, $_ENV['NONCE_ACTION']) ){
        http_response_code(403);
        return ['result' => 'error', 'message' => 'Invalid request'];
      }
      
      try {
          // Get country from address data
          $country = $data->country ?? 'US';

          // Get domain-specific cost based on country
          $default_cost = get_cost_for_domain($data->artistUrl ?? get_origin(), $country);
          $new_cost = $default_cost;

          $stripe = new \Stripe\StripeClient($_ENV['STRIPE_API_KEY']);

          $promo_code = null;
          $coupon_code = null;

          if( !empty($data->promoCodeId) ){

            $promo = $stripe->promotionCodes->retrieve($data->promoCodeId);

            if( $promo->active ){
              // In Stripe SDK v19, coupon ID is nested under promotion->coupon
              $coupon_id = $promo->promotion->coupon ?? null;

              if (!$coupon_id) {
                throw new \Exception('Invalid promotion code');
              }

              $coupon = $stripe->coupons->retrieve($coupon_id);

              if( $coupon->percent_off !== null ){
                  $new_cost = $default_cost - ($default_cost * ($coupon->percent_off / 100));
              }
              else if( $coupon->amount_off !== null ){
                  $new_cost = $default_cost - $coupon->amount_off;
              }

              if( $new_cost < 0 ){
                  $new_cost = 0;
              }

              // Store promo info for metadata
              $promo_code = $data->promoCodeId;
              $coupon_code = $promo->code ?? '';
            }
          }

          // Create a PaymentIntent with amount and currency
          // Note: Stripe allows $0 payment intents for tracking purposes
          $paymentIntentParams = [
            'amount' => $new_cost,
            'currency' => 'usd',
            'payment_method_types' => ['card'],
          ];

          // Add metadata to track promo code usage
          if( $promo_code ){
            $paymentIntentParams['metadata'] = [
              'promotion_code_id' => $promo_code,
              'coupon_code' => $coupon_code,
              'original_amount' => $default_cost,
              'discounted_amount' => $new_cost,
            ];
          }

          $paymentIntent = $stripe->paymentIntents->create($paymentIntentParams);

          return $paymentIntent;

        } catch (\Throwable $th) {
          if ($_ENV['APP_ENV'] === 'development') {
            error_log('Payment handler error: ' . $th->getMessage());
          }
          return ['result' => 'error', 'message' => 'Unable to process payment'];
        }
    }
}