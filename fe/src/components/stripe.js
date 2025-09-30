import './Stripe.css';
import React, { useState, useEffect } from 'react';
import {loadStripe} from '@stripe/stripe-js';
import {
  CardElement,
  Elements,
  useStripe,
  useElements,
  PaymentRequestButtonElement
} from '@stripe/react-stripe-js';

import { ButtonLabelVerify, ButtonLabelVerifying, ButtonLabelVerified } from './ButtonLabels';


const CheckoutForm = (props) => {
  const stripe = useStripe();
  const elements = useElements();
  const [ isLoading, setIsLoading ] = useState(false);
  const [ message, setMessage ] = useState(null);
  const [ messageType, setMessageType ] = useState(''); // 'error', 'success', or ''
  const [ paymentSuccessful, setPaymentSuccessful ] = useState(false);
  const [ promoCode, setPromoCode] = useState({});
  const [ promoInput, setPromoInput ] = useState(''); // New state for input value
  const [ promoValidating, setPromoValidating ] = useState(false); // New state for validation loading
  const [ cost, setCost ] = useState(0); // Start with 0, will be set from backend
  const [ defaultCost, setDefaultCost ] = useState(0); // Domain-specific default cost
  const [paymentRequest, setPaymentRequest] = useState(null);
  const [canMakePayment, setCanMakePayment] = useState(false);

  // Get domain-specific cost on component mount
  useEffect(() => {
    const fetchDomainCost = async () => {
      const urlSearchParams = new URLSearchParams(window.location.search);
      const artistUrl = urlSearchParams.get('artistUrl');
      
      try {
        const response = await fetch(process.env.REACT_APP_BACKEND_URL + '/cost', {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            'Access-Control-Allow-Origin': process.env.REACT_APP_FRONTEND_ORIGIN
          },
          body: JSON.stringify({
            artistUrl: artistUrl,
            nonce: document.querySelector('input[name="nonce"]').value
          }),
          mode: 'cors',
          credentials: 'same-origin',
          cache: 'no-cache',
          redirect: 'follow'
        });
        
        const data = await response.json();
        if (data.cost) {
          setDefaultCost(data.cost);
          setCost(data.cost);
        } else {
          // Fallback to 80 cents if no cost returned
          setDefaultCost(80);
          setCost(80);
        }
      } catch (error) {
        console.error('Error fetching domain cost:', error);
        // Fallback to 80 cents if error
        setDefaultCost(80);
        setCost(80);
      }
    };

    fetchDomainCost();
  }, []);

  const setMessageWithType = (msg, type = '') => {
    setMessage(msg);
    setMessageType(type);
  };

  const sendPostcard = React.useCallback(async (paymentIntent = null) => {
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
  }, [cost, promoCode, props.billingDetails, props.email, props.paymentIntent]);

  // Apple Pay / Payment Request Button setup - create once
  useEffect(() => {
    if (!stripe || paymentRequest) {
      return;
    }

    const pr = stripe.paymentRequest({
      country: 'US',
      currency: 'usd',
      total: {
        label: 'Postcard',
        amount: cost,
      },
      requestPayerName: true,
      requestPayerEmail: true,
    });

    // Check if Payment Request is available (Apple Pay, Google Pay, etc.)
    pr.canMakePayment().then((result) => {
      if (result) {
        setPaymentRequest(pr);
        setCanMakePayment(true);
      }
    });

    pr.on('paymentmethod', async (ev) => {
      console.log('Apple Pay paymentmethod event triggered');
      
      // Validate required fields
      if (!props.billingDetails.line1 || props.billingDetails.line1.length === 0) {
        console.error('Validation failed: no delivery address');
        ev.complete('fail');
        setMessageWithType('Please verify the delivery address first.', 'error');
        return;
      }

      if (props.email.length === 0) {
        console.error('Validation failed: no email');
        ev.complete('fail');
        setMessageWithType('Please enter your email address first.', 'error');
        return;
      }

      console.log('Starting payment confirmation with client_secret:', props.paymentIntent.client_secret);
      setIsLoading(true);

      try {
        // Confirm the payment with Stripe
        const {error: confirmError, paymentIntent} = await stripe.confirmCardPayment(
          props.paymentIntent.client_secret,
          {
            payment_method: ev.paymentMethod.id,
          },
          {handleActions: false}
        );

        console.log('Confirmation response:', { confirmError, paymentIntent });

        if (confirmError) {
          console.error('Apple Pay confirmation error:', confirmError);
          ev.complete('fail');
          setMessageWithType(`Payment failed: ${confirmError.message}`, 'error');
          setIsLoading(false);
        } else if (paymentIntent && paymentIntent.status === 'succeeded') {
          console.log('Payment succeeded!');
          ev.complete('success');
          setPaymentSuccessful(true);
          setMessageWithType('Payment successful! You\'ll receive an email receipt shortly.', 'success');
          
          // Send postcard after successful payment
          await sendPostcard(paymentIntent);
          setIsLoading(false);
        } else if (paymentIntent && paymentIntent.status === 'requires_action') {
          console.log('Payment requires additional action');
          // Handle 3D Secure or other actions
          const {error: actionError} = await stripe.handleCardAction(props.paymentIntent.client_secret);
          if (actionError) {
            console.error('Apple Pay action error:', actionError);
            ev.complete('fail');
            setMessageWithType(`Payment failed: ${actionError.message}`, 'error');
            setIsLoading(false);
          } else {
            ev.complete('success');
            setPaymentSuccessful(true);
            setMessageWithType('Payment successful! You\'ll receive an email receipt shortly.', 'success');
            await sendPostcard(paymentIntent);
            setIsLoading(false);
          }
        } else {
          console.error('Unexpected payment status:', paymentIntent?.status);
          ev.complete('fail');
          setMessageWithType(`Payment failed with status: ${paymentIntent?.status || 'unknown'}`, 'error');
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Apple Pay processing error:', error);
        ev.complete('fail');
        setMessageWithType(`Payment error: ${error.message || 'Unknown error occurred'}`, 'error');
        setIsLoading(false);
      }
    });
  }, [stripe, paymentRequest, cost, props.billingDetails, props.email, props.paymentIntent.client_secret, sendPostcard]);

  // Update the payment request when cost changes
  useEffect(() => {
    if (paymentRequest) {
      paymentRequest.update({
        total: {
          label: 'Postcard',
          amount: cost,
        },
      });
    }
  }, [cost, paymentRequest]);

  const validatePromoCode = async () => {
    if (promoInput.trim().length === 0) {
      setMessageWithType('Please enter a promo code', 'error');
      return;
    }

    setPromoValidating(true);
    setMessageWithType('');

    const urlSearchParams = new URLSearchParams(window.location.search);
    const artistUrl = urlSearchParams.get('artistUrl');

    const promoBody = {
      promo: promoInput.trim(),
      nonce: document.querySelector('input[name="nonce"]').value,
      paymentIntent: props.paymentIntent,
      artistUrl: artistUrl // Include artistUrl for domain-specific calculations
    };

    try {
      const promoResponse = await fetch(process.env.REACT_APP_BACKEND_URL + '/promo', {
        method: "POST",
        body: JSON.stringify(promoBody),
        mode: 'cors',
        credentials: 'same-origin',
        cache: 'no-cache',
        redirect: 'follow',
        headers: {
          'Access-Control-Allow-Origin': process.env.REACT_APP_FRONTEND_ORIGIN,
          "Content-Type": "application/json"
        }
      });
      
      const promoResponseDecoded = await promoResponse.json();

      if (promoResponseDecoded.result === 'error') {
        setMessageWithType(promoResponseDecoded.message, 'error');
        setCost(defaultCost);
        setPromoCode({});
      } else if (promoResponseDecoded.active) {
        setPromoCode(promoResponseDecoded);

        // Calculate new cost using domain-specific default
        let newCost = defaultCost;
        if (promoResponseDecoded.coupon.percent_off !== null) {
          newCost = defaultCost - (defaultCost * (promoResponseDecoded.coupon.percent_off / 100));
        } else if (promoResponseDecoded.coupon.amount_off !== null) {
          newCost = defaultCost - promoResponseDecoded.coupon.amount_off;
        }
        
        newCost = Math.max(0, newCost); // Ensure cost doesn't go below 0

        setCost(newCost);

        // Update payment intent with new cost
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
            promoCodeId: promoResponseDecoded.id,
            artistUrl: artistUrl // Include artistUrl for domain-specific processing
          }),
          mode: 'cors',
          credentials: 'same-origin',
          cache: 'no-cache',
          redirect: 'follow'
        });

        const stripeResponseDecoded = await stripeResponse.json();
        if (stripeResponseDecoded.client_secret) {
          props.setPaymentIntent(stripeResponseDecoded);
        }
      }
    } catch (error) {
      console.log(error);
      setMessageWithType('Error validating promo code. Please try again.', 'error');
      setCost(defaultCost);
      setPromoCode({});
    } finally {
      setPromoValidating(false);
    }
  };

  const clearPromoCode = () => {
    setPromoInput('');
    setPromoCode({});
    setCost(defaultCost);
    // Reset payment intent to original cost if needed
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    // Validate payer name
    if( props.payerName.length === 0 ){
      setMessageWithType('Please enter your name for the payment.', 'error');
      return;
    }

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
              name: props.payerName, // Use payer name for Stripe billing
              email: props.email,
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

  // Show loading state while fetching cost
  if (defaultCost === 0) {
    return (
      <div className="stripecontainer">
        <div style={{ textAlign: 'center', padding: '20px' }}>
          Loading pricing information...
        </div>
      </div>
    );
  }

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
        {/* Payer name field */}
        <div className="form-row">
          <label htmlFor='payerName'>
            Your name<small>(for payment)</small>
          </label>
          <input
            type="text"
            id='payerName'
            onChange={ e => {
              props.setPayerName(e.target.value)
              // Clear name-related errors when typing
              if (message && (message.includes('name') || message.includes('Name'))) {
                setMessageWithType('');
              }
            } }
            value={props.payerName}
            placeholder="Enter your full name"
          />
        </div>

        {/* Email field */}
        <div className="form-row">
          <label htmlFor='email'>
            Email<small>(for receipt)</small>
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

        {/* Promo code section */}
        <div className="promo-section">
          <input 
            type="text" 
            value={promoInput}
            onChange={(e) => setPromoInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                validatePromoCode();
              }
            }}
            placeholder="Enter promo code" 
            disabled={promoValidating || Object.keys(promoCode).length > 0}
          />
          
          {Object.keys(promoCode).length === 0 ? (
            <button 
              type="button"
              onClick={validatePromoCode}
              disabled={promoValidating || promoInput.trim().length === 0}
            >
              {promoValidating ? 'Validating...' : 'Apply'}
            </button>
          ) : (
            <button 
              type="button"
              onClick={clearPromoCode}
              className="remove"
            >
              Remove
            </button>
          )}
        </div>

        {/* Apple Pay / Google Pay Button */}
        {canMakePayment && paymentRequest && cost >= 50 && (
          <div className="apple-pay-container">
            <PaymentRequestButtonElement 
              options={{
                paymentRequest,
                style: {
                  paymentRequestButton: {
                    type: 'buy',
                    theme: 'dark',
                    height: '44px',
                  },
                },
              }}
            />
            <div className="apple-pay-divider">
              or pay with card
            </div>
          </div>
        )}
        
        {cost >= 50 && (
          <>
            <label style={{alignSelf: 'center', minWidth: '5em', marginRight: '1em', textAlign: 'end'}}></label>
            <CardElement 
              options={{
                style: {
                  base: {
                    fontSize: '16px',
                    color: '#424770',
                    '::placeholder': {
                      color: '#aab7c4',
                    },
                  },
                },
              }}
            />
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
          payerName={props.payerName}
          setPayerName={props.setPayerName}
          setPaymentIntent={props.elementsOptions.setPaymentIntent}
        />
      </Elements>
    );
  }
};