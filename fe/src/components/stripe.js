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
  const [ messageType, setMessageType ] = useState(''); // 'error', 'success', or ''
  const [ paymentSuccessful, setPaymentSuccessful ] = useState(false);
  const [ promoCode, setPromoCode] = useState({});
  const [ cost, setCost ] = useState(defaultCost);

  const setMessageWithType = (msg, type = '') => {
    setMessage(msg);
    setMessageType(type);
  };

  const sendPostcard = async (paymentIntent = null) => {
    let body = {
      to: {
        ...props.billingDetails,
        email: props.email // Add email to the billing details
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
        setMessageWithType(`Payment successful! You'll receive an email receipt shortly. <a href="${lobResponseDecoded.url}" target="_blank" rel="noopener noreferrer">Preview your postcard here</a>. Please allow 10-14 business days for delivery.`, 'success');
      }
    
    } catch (error) {
      console.error('An error occurred:', error);
      setMessageWithType('An error occurred while processing your order. Please try again.', 'error');
    }
  }


  const handleSubmit = async (event) => {
    event.preventDefault();

    // Validate email before processing payment
    if( props.email.length === 0 ){
      setMessageWithType('Please enter your email address to receive the receipt.', 'error');
      return;
    }
    else if( props.email.match(
      // eslint-disable-next-line no-useless-escape
      /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    ) === null ){
      setMessageWithType('Please enter a valid email address.', 'error');
      return;
    }

    if (elements == null) {
      return;
    }

    setIsLoading(true);
    setMessageWithType(''); // Clear any existing messages

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
        setMessageWithType(response.error.message, 'error');
      }
      else if( response.paymentIntent ){
        if( response.paymentIntent.status === 'succeeded' ){
          setMessageWithType('Payment successful! You\'ll receive an email receipt shortly.', 'success');
          setPaymentSuccessful(true);
          
          sendPostcard(response.paymentIntent);
        }
        else if( response.paymentIntent.status === 'processing' ){
          setMessageWithType('Payment is being processed. We\'ll update you when it\'s complete.', 'success');
        }
        else if( response.paymentIntent.status === 'requires_payment_method' ){
          setMessageWithType('Payment failed. Please try a different payment method.', 'error');
        }
      }
      else {
        setMessageWithType('An unexpected error occurred. Please try again.', 'error');
      }
    }
    

    setIsLoading(false);

  };

  const promoChangeHandler = debounce(async (e) => {
    if( e.target.value.length === 0 ){
      setMessageWithType('');
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
        setMessageWithType(promoResponseDecoded.message, 'error');
        setCost(defaultCost);
      }
      else if( promoResponseDecoded.active ){
        setPromoCode(promoResponseDecoded);
        setMessageWithType('Promo code applied successfully!', 'success');

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
      setMessageWithType('Error validating promo code. Please try again.', 'error');
    }


  }, 300);

  return (
    <div className="stripecontainer">
      <h2 className="total">Total: {new Intl.NumberFormat('en-US', {
          currency: 'USD',
          style: 'currency'
      }).format(cost / 100)}</h2>
      <div className="description">Complete your payment to send your postcard. Shipping rates may vary by location.</div>
      
      {/* Show any error or success messages */}
      {message && (
        <div id="payment-message" className={messageType} dangerouslySetInnerHTML={{ __html: message }}></div>
      )}
      
      <form className="stripeform" onSubmit={handleSubmit}>
        {/* Email field */}
        <div className="email-field">
          <label htmlFor='email'>
            Email Address
            <br /><small>We'll send your receipt here</small>
          </label>
          <input
            type="email"
            id='email'
            onChange={ e => {
              props.setEmail(e.target.value)
              // Clear email-related errors when typing
              if (message && (message.includes('email') || message.includes('Email'))) {
                setMessageWithType('');
              }
            } }
            value={props.email}
            placeholder="Enter your email address"
          />
        </div>

        <input 
          type="text" 
          name="promo" 
          className="stripeform-promo" 
          placeholder="Promo code (optional)" 
          onChange={ promoChangeHandler } 
        />
        
        {cost >= 50 && (
          <>
            <label className="card-label">Card Information</label>
            <CardElement />
          </>
        )}
        
        <button 
          type="submit" 
          className={isLoading ? 'loading' : (paymentSuccessful ? 'paid' : "")} 
          disabled={isLoading || !stripe || !elements || paymentSuccessful}
        >
          {isLoading ? ButtonLabelVerifying('Processing Payment') : (paymentSuccessful ? ButtonLabelVerified('Payment Complete') : ButtonLabelVerify(`Pay ${new Intl.NumberFormat('en-US', { currency: 'USD', style: 'currency' }).format(cost / 100)}`)) }
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
          setPaymentIntent={props.elementsOptions.setPaymentIntent}
        />
      </Elements>
    );
  }
};