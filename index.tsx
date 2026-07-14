const originalParse = JSON.parse; 
JSON.parse = function(text, reviver) { 
  if (text === undefined || text === "undefined") { 
    return {}; // Gracefully handle "undefined"
  } 
  return originalParse.apply(this, arguments); 
};
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
