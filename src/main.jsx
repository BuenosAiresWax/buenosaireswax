import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import { CartProvider } from "./context/CartContext";
import { PlayerProvider } from "./player/PlayerContext.jsx"; // <-- NUEVO
import AdminRoute from "./components/AdminRoute.jsx";
import ProductPage from "./components/ProductPage.jsx";
import AppLayout from "./components/AppLayout.jsx";
import CatalogPage from "./components/CatalogPage.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <CartProvider>
      <PlayerProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<App />} />
              <Route path="drop" element={<App forceDrop />} />
              <Route path="producto/:id" element={<ProductPage catalogKey="drop" />} />
              <Route path="tienda" element={<CatalogPage catalogKey="tienda" />} />
              <Route
                path="tienda/producto/:id"
                element={<ProductPage catalogKey="tienda" />}
              />
              <Route
                path="equipamiento"
                element={<CatalogPage catalogKey="equipamiento" />}
              />
              <Route
                path="equipamiento/producto/:id"
                element={<ProductPage catalogKey="equipamiento" />}
              />
            </Route>
            <Route path="/admin" element={<AdminRoute />} />
          </Routes>
        </HashRouter>
      </PlayerProvider>
    </CartProvider>
  </StrictMode>,
);