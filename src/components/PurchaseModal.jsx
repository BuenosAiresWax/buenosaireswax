  const isArtlabPickup = metodoEntrega === "artlab";
  const isRetiro = isArtlabPickup || metodoEntrega.includes("Retiro");
  const esDropCheckout = catalog.key === "drop";
  const origenCompra = esDropCheckout ? "Drop" : "Tienda fisica";
  const aliasPago = esDropCheckout ? "E110101" : "BuenosAiresWax";
  const metodoEntregaDetalle = isArtlabPickup
    ? "Punto de retiro Artlab (Rosetti 93, viernes y sabados de 19:00 a 23:59)"
    : metodoEntrega;
