import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom"; // usá HashRouter para Vercel
import "./index.css";
import App from "./App.jsx";  // tu ecommerce
import { CartProvider } from "./context/CartContext";
import AdminRoute from "./components/AdminRoute.jsx"; // import correcto
import ProductPage from "./components/ProductPage.jsx";
import AppLayout from "./components/AppLayout.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <CartProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<App />} />
            <Route path="producto/:id" element={<ProductPage />} />
          </Route>
          <Route path="/admin" element={<AdminRoute />} />
        </Routes>
      </HashRouter>
    </CartProvider>
  </StrictMode>
);
