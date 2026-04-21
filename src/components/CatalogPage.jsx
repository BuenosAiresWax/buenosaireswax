import { useState } from "react";
import ProductList from "./ProductList";
import PurchaseModal from "./PurchaseModal";
import CartPopupButton from "./CartPopupButton";
import HeroSlider from "./HeroSlider";
import { getCatalogConfig } from "../utils/catalog";

function CatalogPage({ catalogKey }) {
  const [mostrarModal, setMostrarModal] = useState(false);
  const catalog = getCatalogConfig(catalogKey);

  return (
    <>
      <HeroSlider />

      <ProductList catalogKey={catalog.key} />

      <CartPopupButton onOpen={() => setMostrarModal(true)} catalogKey={catalog.key} />

      {mostrarModal && (
        <PurchaseModal onClose={() => setMostrarModal(false)} catalogKey={catalog.key} />
      )}
    </>
  );
}

export default CatalogPage;