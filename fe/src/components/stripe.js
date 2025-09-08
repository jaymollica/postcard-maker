import './Stripe.css';
import React, { useState } from 'react';
import {loadStripe} from '@stripe/stripe-js';
import debounce from 'lodash.debounce';
import {
  CardElement,
  Elements,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

import { ButtonLabelVerify, ButtonLabelVerifying, ButtonLabelVerified } from './ButtonLabels';


const CheckoutForm = (props) => {
  // cost is in USD cents (eg 100 = $1.00 USD)
  const defaultCost = 80;

  const stripe = useStripe();
  const elements = useElements();
  const [ isLoading, setIsLoading ] = useState(false);
  const [ message, setMessage ] = useState(null);
  const [ paymentSuccessful, setPaymentSuccessful ] = useState(false);
  const [ promoCode, setPromoCode] = useState({});
  const [ cost, setCost ] = useState(defaultCost);

  const sendPostcard = async (paymentIntent = null) => {
    let body = {
      to: {
        ...props.billingDetails,
        email: props.email
      },
      paymentIntent : paymentIntent === null ? props.paymentIntent : paymentIntent,
      nonce : document.querySelector('input[name="nonce"]').value,
      promo : Object.keys(promoCode).length > 0 ? promoCode : null,
      merge_variables : {}
    };
    
    const urlSearchParams = new URLSearchParams(document.location.search);
    if( urlSearchParams.get('optionalParams') && urlSearchParams.get('optionalParams').length > 0 ){
      try {
        // Simple URL decoding - no base64 involved
        const optionalParamsEncoded = urlSearchParams.get('optionalParams');
        const decodedOptionalParams = JSON.parse(decodeURIComponent(optionalParamsEncoded));
        body.merge_variables = decodedOptionalParams;
      } catch (error) {
        console.error('Error decoding optionalParams:', error);
        // Fall back to empty merge_variables if decoding fails
        body.merge_variables = {};
      }
    }

    if( urlSearchParams.get('imgUrl').length > 0 ){
      body.merge_variables.artworkImageURL = urlSearchParams.get('imgUrl');
    }

    if( urlSearchParams.get('artistUrl').length > 0 ){
      body.artistUrl = urlSearchParams.get('artistUrl');
    }

    body.cost = cost;

    try {
      const lobResponse = await fetch(process.env.REACT_APP_BACKEND_URL + '/lob', {
        method: "POST",
        body: JSON.stringify(body),
        mode: 'cors', // no-cors, *cors, same-origin
        credentials: 'same-origin', // include, *same-origin, omit
        cache: 'no-cache',
        redirect: 'follow',
        headers: {
          'Access-Control-Allow-Origin': process.env.REACT_APP_FRONTEND_ORIGIN,
          "Content-Type": "application/json"
        }
      });
      
      const lobResponseDecoded = await lobResponse.json();
      
      if( lobResponseDecoded.url ){
        setMessage(`Your payment was successful! You should receive an email with your receipt and order number.<br />Preview your postcard <a href="${lobResponseDecoded.url}" target="_blank">here</a>. Since each postcard is printed on demand, please allow 10-14 business days for arrival.`);
      }
    
    } catch (error) {
      console.error('An error occurred:', error);
      setMessage(error);
    }
  }


  const handleSubmit = async (event) => {
    event.preventDefault();

    // Validate email before processing payment
    if( props.email.length === 0 ){
      setMessage('Email is required for receipt');
      return;
    }
    else if( props.email.match(
      // eslint-disable-next-line no-useless-escape
      /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    ) === null ){
      setMessage('Email is invalid');
      return;
    }

    if (elements == null) {
      return;
    }

    setIsLoading(true);

    // if the cost is 0 then no need to use stripe
    let bypassStripe = false;
    if( cost === 0 ){
      bypassStripe = true;
    }

    if( bypassStripe ){
      setPaymentSuccessful(true);
          
      sendPostcard(props.paymentIntent);
    }
    else{
      const response = await stripe.confirmCardPayment(props.paymentIntent.client_secret, {
          payment_method: {
            card: elements.getElement(CardElement),
            billing_details: {
              name: props.billingDetails.name,
              email: props.email, // Use email from props
              address: {
                city: props.billingDetails.city,
                state: props.billingDetails.state,
              line1: props.billingDetails.line1,
              line2: props.billingDetails.line2,
              postal_code: props.billingDetails.postal_code,
            }
          },
        },
        return_url: process.env.REACT_APP_FRONTEND_URL
        
      });
      // This point will only be reached if there is an immediate error when
      // confirming the payment. Otherwise, your customer will be redirected to
      // your `return_url`. For some payment methods like iDEAL, your customer will
      // be redirected to an intermediate site first to authorize the payment, then
      // redirected to the `return_url`.
      if ( response.error && (response.error.type === "card_error" || response.error.type === "validation_error") ) {
        setMessage(response.error.message);
      }
      else if( response.paymentIntent ){
        if( response.paymentIntent.status === 'succeeded' ){
          setMessage('Your payment was successful! You should receive an email with your receipt and order number.');
          setPaymentSuccessful(true);
          
          sendPostcard(response.paymentIntent);
        }
        else if( response.paymentIntent.status === 'processing' ){
          setMessage('Payment processing. We\'ll update you when payment is received.');
        }
        else if( response.paymentIntent.status === 'requires_payment_method' ){
          setMessage('Payment failed. Please try another payment method.');
        }
      }
      else {
        setMessage("An unexpected error occurred.");
      }
    }
    

    setIsLoading(false);

  };

  const promoChangeHandler = debounce(async (e) => {
    if( e.target.value.length === 0 ){
      setMessage('');
      setCost(defaultCost);
      return;
    }

    const promoBody = {
      promo: e.target.value,
      nonce : document.querySelector('input[name="nonce"]').value,
      paymentIntent : props.paymentIntent
    };
    try {
      
      const promoResponse = await fetch(process.env.REACT_APP_BACKEND_URL + '/promo', {
        method: "POST",
        body: JSON.stringify(promoBody),
        mode: 'cors', // no-cors, *cors, same-origin
        credentials: 'same-origin', // include, *same-origin, omit
        cache: 'no-cache',
        redirect: 'follow',
        headers: {
          'Access-Control-Allow-Origin': process.env.REACT_APP_FRONTEND_ORIGIN,
          "Content-Type": "application/json"
        }
      });
      
      const promoResponseDecoded = await promoResponse.json();

      console.log(promoResponseDecoded);
      setPromoCode({});

      if( typeof promoResponseDecoded.result !== 'undefined' && promoResponseDecoded.result === 'error' ){
        setMessage(promoResponseDecoded.message);
        setCost(defaultCost);
      }
      else if( promoResponseDecoded.active ){
        setPromoCode(promoResponseDecoded);
        setMessage('Promo code is valid!');

        let newCost = cost;

        if( promoResponseDecoded.coupon.percent_off !== null ){
          newCost = cost - (cost * (promoResponseDecoded.coupon.percent_off / 100));
        }
        else if( promoResponseDecoded.coupon.amount_off !== null ){
          newCost = cost - promoResponseDecoded.coupon.amount_off;
        }

        if( newCost < 0 ){
          newCost = 0;
        }

        setCost(newCost);

        // make & set updated payment intent
        const stripeResponse = await fetch(process.env.REACT_APP_BACKEND_URL + "/stripe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            'Access-Control-Allow-Origin': process.env.REACT_APP_FRONTEND_ORIGIN
          },
          body: JSON.stringify({
            items: [{ id: "postcard-4x6" }],
            nonce: promoBody.nonce,
            cost: newCost,
            promoCodeId : promoResponseDecoded.id
          }),
          mode: 'cors', // no-cors, *cors, same-origin
          credentials: 'same-origin', // include, *same-origin, omit
          cache: 'no-cache',
          redirect: 'follow'
        });

        const stripeResponseDecoded = await stripeResponse.json();

        if( stripeResponseDecoded.clientSecret ){
          props.setPaymentIntent(stripeResponseDecoded);
        }
      }
    } catch (error) {
      console.log(error);
    }


  }, 300);

  return (
    <div className="stripecontainer">
    <h2 className="total">Your payment total is {new Intl.NumberFormat('en-US', {
        currency: 'USD',
        style: 'currency'
    }).format(cost / 100)}</h2>
    <div className="description">Rates may vary depending on geographic location.</div>
    <form className="stripeform" onSubmit={handleSubmit}>
      {/* Show any error or success messages */}
      {message && <div id="payment-message" dangerouslySetInnerHTML={{ __html: message }}></div>}
      
      {/* Email field */}
      <div style={{display: 'flex', flexDirection: 'row', marginBottom: '1em'}}>
        <label style={{alignSelf: 'center', minWidth: '5em', marginRight: '1em', textAlign: 'end'}} htmlFor='email'>
          Email<br /><small>(for receipt)</small>
        </label>
        <input
          style={{ 
            backgroundColor: 'rgb(255, 255, 255)',
            border: '1px solid rgb(204, 204, 204)',
            borderRadius: '4px',
            boxSizing: 'border-box',
            minHeight: '38px',
            outline: '0px',
            padding: '0px 8px',
            width: '100%',
            marginBottom: 'auto',
          }}
          type="email"
          id='email'
          onChange={ e => {
            props.setEmail(e.target.value)
          } }
          value={props.email}
        />
      </div>

      <input type="text" name="promo" className="stripeform-promo" placeholder="Promo code" onChange={ promoChangeHandler } />
      {cost >= 50 && <CardElement />}
      <button type="submit" className={isLoading ? 'loading' : (paymentSuccessful ? 'paid' : "")} disabled={isLoading || !stripe || !elements || paymentSuccessful}>
        {isLoading ? ButtonLabelVerifying('Paying') : (paymentSuccessful ? ButtonLabelVerified('Paid') : ButtonLabelVerify('Pay')) }
      </button>
    </form>
    </div>
  );
};

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

export default function Stripe(props) {
  if( props.addressVerified ){
    return (

      <Elements stripe={stripePromise} options={{ clientSecret : props.elementsOptions.paymentIntent.clientSecret }}>
        <CheckoutForm 
          billingDetails={props.billingDetails} 
          paymentIntent={ props.elementsOptions.paymentIntent }
          email={props.email}
          setEmail={props.setEmail}
        />
      </Elements>
    );
  }
};