import React from "react";
import ReactDOM from "react-dom/client";
import AppUI from "./AppUI.jsx";

const elementoRaiz = document.getElementById("root");

if (!elementoRaiz) {
  throw new Error(
    'No se encontró el elemento raíz con id="root".'
  );
}

ReactDOM.createRoot(elementoRaiz).render(
  <React.StrictMode>
    <AppUI />
  </React.StrictMode>
);