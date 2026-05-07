import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import mixpanel from 'mixpanel-browser';

const root = ReactDOM.createRoot(document.getElementById('root'));
const urlSearchParams = new URLSearchParams(window.location.search);

mixpanel.init('44dc211c74066867cc2ad3d2888384df', {debug: true});

mixpanel.track('Page View', {
    'url' : urlSearchParams.get('artistUrl')
});

// Umami analytics, production-only. Auto-tracks pageviews; custom events
// fire from analytics.js -> umami.track() throughout the React tree.
if (process.env.NODE_ENV === 'production' && !document.getElementById('umami-script')) {
    const s = document.createElement('script');
    s.id = 'umami-script';
    s.defer = true;
    s.src = 'https://analytics.olliemail.net/script.js';
    s.setAttribute('data-website-id', '0ffd408b-d119-4243-aa03-0eb8f9a557de');
    document.head.appendChild(s);
}

root.render(<App />);
