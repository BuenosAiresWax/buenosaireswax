import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { CartProvider } from './context/CartContext'; // ⬅️ importá el contexto

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CartProvider> {/* ⬅️ envolvés tu App con el contexto */}
      <App />
    </CartProvider>
  </StrictMode>
);
