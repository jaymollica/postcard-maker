import './App.css';
import React, { useState, useEffect, useMemo } from 'react';
// import Geo from './components/geo.js';
import Form from './components/form.js';
import Stripe from './components/stripe.js';
import Landing from './components/Landing.js';
import Tracking from './components/Tracking.js';
import { track } from './analytics.js';

// Sitewide footer: copyright + Privacy/Terms links. Used on landing,
// checkout (main), success, cancel, and tracking views.
function Footer() {
  const linkStyle = { color: 'inherit', textDecoration: 'underline' };
  const sepStyle = { color: '#ccc', margin: '0 4px' };
  return (
    <footer style={{
      marginTop: '60px',
      padding: '24px 20px',
      borderTop: '1px solid #eee',
      textAlign: 'center',
      fontSize: '13px',
      color: '#888',
      fontWeight: 300,
    }}>
      &copy; {new Date().getFullYear()} Vague Media LLC{' '}
      <span style={sepStyle}>·</span>{' '}
      <a href="/privacy" style={linkStyle}>Privacy</a>{' '}
      <span style={sepStyle}>·</span>{' '}
      <a href="/terms" style={linkStyle}>Terms</a>
    </footer>
  );
}

function App() {

  const [billingDetails, setBillingDetails] = useState({});
  const [recipientName, setRecipientName] = useState(''); // Name of person receiving postcard
  const [payerName, setPayerName] = useState(''); // Name of person paying
  const [email, setEmail] = useState('');
  const [addressVerified, setAddressVerified] = useState(false)
  const [paymentIntent, setPaymentIntent] = useState("");
  const [nonce, setNonce] = useState("");

  const urlSearchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const isSuccessPage = urlSearchParams.get('success') === 'true';
  const isCancelPage = urlSearchParams.get('cancel') === 'true';
  const trackId = urlSearchParams.get('track');
  const isTracking = !!trackId && !isSuccessPage && !isCancelPage;
  const isMainPage = !isSuccessPage && !isCancelPage && !isTracking;
  const imgUrl = urlSearchParams.get('imgUrl');
  // Visitors who land on the domain directly (no imgUrl) get the marketing
  // landing page instead of a broken postcard preview.
  const isLanding = isMainPage && !imgUrl;

  useEffect(() => {
    const fetchSecret = () => {
      if( nonce.length === 0 ){
        fetch(process.env.REACT_APP_BACKEND_URL + '/nonce', {
          method: "POST",
          mode: 'cors',
          credentials: 'same-origin',
          cache: 'no-cache',
          redirect: 'follow',
          headers: {
            'Access-Control-Allow-Origin': process.env.REACT_APP_FRONTEND_ORIGIN,
            "Content-Type": "application/json"
          }
        })
        .then(res => res.json())
        .then(data => {
          setNonce(data.nonce);
          
          const artistUrl = urlSearchParams.get('artistUrl');
          
          fetch(process.env.REACT_APP_BACKEND_URL + "/stripe", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              'Access-Control-Allow-Origin': process.env.REACT_APP_FRONTEND_ORIGIN
            },
            body: JSON.stringify({
              items: [{ id: "postcard-4x6" }],
              nonce: data.nonce,
              artistUrl: artistUrl  // Add artistUrl for domain-specific pricing
            }),
            mode: 'cors', // no-cors, *cors, same-origin
            credentials: 'same-origin', // include, *same-origin, omit
            cache: 'no-cache',
            redirect: 'follow'
          })
          .then(res => res.json())
          .then(data => {
            console.log('Initial payment intent response:', data);
            if (data.client_secret) {
              console.log('Payment intent created with client_secret:', data.client_secret);
              setPaymentIntent(data);
            } else {
              console.error('No client_secret in initial payment intent:', data);
            }
          })
          .catch(error => {
            console.error('Error creating initial payment intent:', error);
          });
        })
        .catch(error => {
          console.error(error);
        });
      }
    };

    if( isMainPage && !isLanding ){
      fetchSecret();
    }

  }, [nonce, isMainPage, isLanding, urlSearchParams]);

  // Funnel: top-of-funnel event when a visitor lands on the postcard maker
  // (i.e. arrived from an artist site with an imgUrl). Distinct from the
  // landing-page hit Umami records as a regular pageview.
  useEffect(() => {
    if (isMainPage && !isLanding) {
      track('postcard_started');
    }
  }, [isMainPage, isLanding]);

  if( isTracking ){
    return (
      <>
        <Tracking postcardId={trackId} />
        <Footer />
      </>
    );
  }

  if( isLanding ){
    return (
      <>
        <Landing />
        <Footer />
      </>
    );
  }

  if( isMainPage ){
    return (
      <div className="App">
        <div className="head">
          <h1>Postcard Sender</h1>
          <div className="description">The below image can be sent as a physical postcard to an address of your choice by filling out the form on this page. Each postcard is 4 inches by 6 inches (10x15cm) in size. Please be aware some clipping may occur due to the nature of printing the image on paper.</div>
        </div>
        <input type="hidden" name="nonce" value={nonce} />
        <div style={{textAlign: 'center'}} className="imagecontainer">
          <div className="imagecontainer-y">
            <div className="imagecontainer-y-arrow1"></div>
            <span className="imagecontainer-y-number">4"</span>
            <div className="imagecontainer-y-arrow2"></div>
          </div>
          <div className="imagecontainer-x">
            <div className="imagecontainer-x-arrow1"></div>
            <span className="imagecontainer-x-number">6"</span>
            <div className="imagecontainer-x-arrow2"></div>
          </div>
          <div className="imagecontainer-wrapper">
            <img className="imagecontainer-wrapper-image" alt="Your generative artwork" src={imgUrl} style={{maxWidth: '760px'}} />
          </div>
        </div>
        <Form
          postcardGenerated={true}
          setBillingDetails={setBillingDetails}
          recipientName={recipientName}
          setRecipientName={setRecipientName}
          addressVerified={addressVerified}
          setAddressVerified={setAddressVerified}
          />
      
        { paymentIntent.client_secret && <Stripe 
            billingDetails={billingDetails} 
            addressVerified={addressVerified} 
            email={email}
            setEmail={setEmail}
            payerName={payerName}
            setPayerName={setPayerName}
            elementsOptions={{paymentIntent: paymentIntent, setPaymentIntent: setPaymentIntent}}  
          /> }
        
        <Footer />
      </div>
    );
  }
  
  else if( isSuccessPage ){
    return (
      <>
        <div style={{textAlign: 'center'}} className="imagecontainer">
            <img className="imagecontainer-image" alt="Your generative artwork" src={imgUrl} style={{maxWidth: '760px'}} />
          </div>
        <div
        style={{
          maxWidth: '800px',
          margin: '0 auto',
          textAlign: 'center',
          padding: '20px',
        }}
        >
          Thank you for your order! 
        </div>
        <Footer />
      </>
    );
  }
  else if( isCancelPage ){
    // Create a new URL object with the current URL
    const url = new URL(window.location.href);

    // Get the URLSearchParams object from the URL
    const urlSearchParams = url.searchParams;

    // Remove the 'cancel' parameter
    urlSearchParams.delete('cancel');

    // Update the URL object's search parameters
    url.search = urlSearchParams.toString();

    return (
      <>
        <div style={{textAlign: 'center'}} className="imagecontainer">
            <img className="imagecontainer-image" alt="Your generative artwork" src={imgUrl} style={{maxWidth: '760px'}} />
          </div>
        <div
        style={{
          maxWidth: '800px',
          margin: '0 auto',
          textAlign: 'center',
          padding: '20px',
        }}
        >
          Sorry your order canceled. If you want to try again click <a href={url.toString()}>here</a>.
        </div>
        <Footer />
      </>
    );
  }
}

export default App;