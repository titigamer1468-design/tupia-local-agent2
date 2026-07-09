import React from 'react';
import ReactDOM from 'react-dom/client';
import AppUI from "./AppUI.jsx"; // Cambiamos './src/AppUI.jsx' por './AppUI.jsx'
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppUI />
  </React.StrictMode>
);