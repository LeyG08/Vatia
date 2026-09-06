import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
/* Archivo (Omnibus-Type, Buenos Aires) en su versión variable con eje de
 * ancho: una sola familia cubre el texto de interfaz y las etiquetas
 * condensadas de plano. Autohospedada — el editor tiene que verse igual
 * sin conexión, en la obra o en un tablero. */
import "@fontsource-variable/archivo/wdth.css";
import "./estilos.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
