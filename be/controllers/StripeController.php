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
        http_response_code(500);
        return ['result' => 'error', 'message' => 'Bad nonce'];
      }

      if( empty($data->promo) ){
        http_response_code(500);
        return ['result' => 'error', 'message' => 'Must include promo in request'];
      }

      $stripe = new \Stripe\StripeClient($_ENV['STRIPE_API_KEY']);

      try {
        global $default_cost;
        $promos = $stripe->promotionCodes->all(array(
          'active' => true,
          'code' => $data->promo
        ));

        if( count($promos->data) > 0 ){
          
          
          // always return the first promo
          $promo = $promos->data[0];
          
          if( $promo->active ){
            
            if( $promo->coupon->percent_off !== null ){
              $new_cost = $default_cost - ($default_cost * ($promo->coupon->percent_off / 100));
            }
            else if( $promo->coupon->amount_off !== null ){
              $new_cost = $default_cost - $promo->coupon->amount_off;
            }

            if( $new_cost < 0 ){
              $new_cost = 0;
            }

            // update payment intent with new cost with promo applied
            if( $new_cost >= 50 ){
              // update the payment intent
              $stripe->paymentIntents->update($data->paymentIntent->id, array(
                'amount' => $new_cost,
              ));
            }
          }

          return $promo;
        }
        else{
          return ['result' => 'error', 'message' => 'No promo code ' . $data->promo];
        }

      } catch (\Exception $ex) {
        http_response_code($ex->getCode());
        return ['result' => 'error', 'message' => $ex->getMessage()];
      }


    }
    /**
     * Returns a JSON string object to the browser when hitting the root of the domain
     *
     * @url POST /stripe
     */
    public function pay_handler($data){
      
      if( !verify_nonce($data->nonce, $_ENV['NONCE_ACTION']) ){
        http_response_code(500);
        return ['result' => 'error', 'message' => 'Bad nonce'];
      }
      

      
      try {
          global $default_cost;
          $new_cost = $default_cost;
        
          $stripe = new \Stripe\StripeClient($_ENV['STRIPE_API_KEY']);

          if( !empty($data->promoCodeId) ){

            $promo = $stripe->promotionCodes->retrieve(
              $data->promoCodeId,
              []
            );

            if( $promo->active ){

              if( $promo->coupon->percent_off !== null ){
                  $new_cost = $default_cost - ($default_cost * ($promo->coupon->percent_off / 100));
              }
              else if( $promo->coupon->amount_off !== null ){
                  $new_cost = $default_cost - $promo->coupon->amount_off;
              }

              if( $new_cost < 0 ){
                  $new_cost = 0;
              }
            }

          }

          if( $new_cost !== 0 ){

            // Create a PaymentIntent with amount and currency
            $paymentIntent = $stripe->paymentIntents->create([
              'amount' => $new_cost, // update this with new cost if promocodeId retrieves successfully
              'currency' => 'usd',
              'payment_method_types' => ['card'],
            ]);
            
            return $paymentIntent;
          }
          else{
            return ['result' => 'error', 'message' => 'Cannot make paymentIntent when cost is 0'];
          }

        } catch (\Throwable $th) {
          //throw $th;
          return ['result' => 'error', 'message' => $th->getMessage()];
        }
        
    }
}
