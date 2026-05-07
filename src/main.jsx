import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import { CartProvider } from "./context/CartContext";
import { PlayerProvider } from "./player/PlayerContext.jsx"; // <-- NUEVO
import AdminRoute from "./components/AdminRoute.jsx";
import AdminPedidosRealtimeRoute from "./components/AdminPedidosRealtimeRoute.jsx";
import ProductPage from "./components/ProductPage.jsx";
import AppLayout from "./components/AppLayout.jsx";
import CatalogPage from "./components/CatalogPage.jsx";
import CatalogAccessGate from "./components/CatalogAccessGate.jsx";

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
              <Route
                path="tienda"
                element={
                  <CatalogAccessGate sectionKey="tienda" sectionLabel="Tienda de Vinilos">
                    <CatalogPage catalogKey="tienda" />
                  </CatalogAccessGate>
                }
              />
              <Route
                path="tienda/producto/:id"
                element={
                  <CatalogAccessGate sectionKey="tienda" sectionLabel="Tienda de Vinilos">
                    <ProductPage catalogKey="tienda" />
                  </CatalogAccessGate>
                }
              />
              <Route
                path="equipamiento"
                element={
                  <CatalogAccessGate sectionKey="equipamiento" sectionLabel="Equipamiento">
                    <CatalogPage catalogKey="equipamiento" />
                  </CatalogAccessGate>
                }
              />
              <Route
                path="equipamiento/producto/:id"
                element={
                  <CatalogAccessGate sectionKey="equipamiento" sectionLabel="Equipamiento">
                    <ProductPage catalogKey="equipamiento" />
                  </CatalogAccessGate>
                }
              />
            </Route>
            <Route path="/admin" element={<AdminRoute />} />
            <Route
              path="/admin/pedidos-catalogos"
              element={<AdminPedidosRealtimeRoute />}
            />
          </Routes>
        </HashRouter>
      </PlayerProvider>
    </CartProvider>
  </StrictMode>,
);