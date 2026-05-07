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

root.render(<App />);
