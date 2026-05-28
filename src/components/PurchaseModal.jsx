import { useEffect, useRef, useState, useContext, useMemo } from "react";
import { doc, setDoc, updateDoc, increment, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { CartContext } from "../context/CartContext";
import {
  getCartItemKey,
  getCatalogConfig,
  getCatalogKeyByCollectionName,
  getCheckoutCollectionNames,
  getProductCollectionName,
  isCollectionIncludedInCheckout,
} from "../utils/catalog";
import "../styles/PurchaseModal.css";

function PurchaseModal({ onClose, catalogKey = "drop" }) {
  const backdropRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [nombre, setNombre] = useState("");
  const [nombreInstagram, setNombreInstagram] = useState("");
  const [dni, setDni] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [direccion, setDireccion] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [codigoPostal, setCodigoPostal] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [productosAgotados, setProductosAgotados] = useState([]);
  const [pedidoId, setPedidoId] = useState("");
  const [fechaPedido, setFechaPedido] = useState("");
  const [pedidoEnviado, setPedidoEnviado] = useState(false);
  const [mensajeWsp, setMensajeWsp] = useState("");
  const [ultimoTotal, setUltimoTotal] = useState(0);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [metodoEntrega, setMetodoEntrega] = useState("");

  const modalContentRef = useRef(null);
  const modalRef = useRef(null);

  const { cartItems, clearCartByCollection, removeFromCart } =
    useContext(CartContext);
  const catalog = getCatalogConfig(catalogKey);
  const checkoutCollectionNames = useMemo(
    () => getCheckoutCollectionNames(catalogKey),
    [catalogKey],
  );
  const cartItemsByCatalog = useMemo(
    () =>
      cartItems.filter((item) =>
        isCollectionIncludedInCheckout(
          getProductCollectionName(item),
          catalogKey,
        ),
      ),
    [cartItems, catalogKey],
  );
  const total = cartItemsByCatalog.reduce((acc, item) => {
    const precio = Number(item?.precio) || 0;
    const cantidad = Number(item?.cantidad) || 0;
    return acc + precio * cantidad;
  }, 0);
  const totalProductos = cartItemsByCatalog.reduce(
    (acc, item) => acc + (Number(item?.cantidad) || 0),
    0,
  );
  const isArtlabPickup = metodoEntrega === "artlab";
  const isRetiro = isArtlabPickup || metodoEntrega.includes("Retiro");
  const esDropCheckout = catalog.key === "drop";
  const origenCompra = esDropCheckout ? "Drop" : "Tienda fisica";
  const aliasPago = esDropCheckout ? "BuenosAioresWax" : "E110101";
  const metodoEntregaDetalle = isArtlabPickup
    ? "Punto de retiro Artlab (Rosetti 93, viernes y sabados de 19:00 a 23:59)"
    : metodoEntrega;

  useEffect(() => {
    setTimeout(() => setVisible(true), 10);
    if (cartItemsByCatalog.length > 0) {
      checkStockAgotado();
    } else {
      setProductosAgotados([]);
    }
    const totalGuardado = localStorage.getItem("ultimoTotalPedido");
    if (totalGuardado) setUltimoTotal(Number(totalGuardado));
  }, [pedidoEnviado, cartItemsByCatalog]);

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return undefined;
    }

    const scrollY = window.scrollY;
    const { body, documentElement } = document;

    body.classList.add("checkout-modal-open");
    documentElement.classList.add("checkout-modal-open");
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";

    return () => {
      body.classList.remove("checkout-modal-open");
      documentElement.classList.remove("checkout-modal-open");
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      body.style.width = "";
      body.style.overflow = "";
      documentElement.style.overflow = "";
      window.scrollTo(0, scrollY);
    };
  }, []);

  const normalizarNombre = (nombre) =>
    nombre.trim().toLowerCase().replace(/\s+/g, "-");

  const getProductRef = (item) => {
    const docId = item?.id
      ? String(item.id)
      : normalizarNombre(item?.titulo || "");
    return doc(db, getProductCollectionName(item), docId);
  };

  const checkStockAgotado = async () => {
    const agotados = [];
    for (const item of cartItemsByCatalog) {
      const ref = getProductRef(item);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const { cantidad = 0, reservados = 0 } = snap.data();
        const stockDisponible = cantidad - reservados;
        if (stockDisponible <= 0 || stockDisponible < item.cantidad) {
          agotados.push(getCartItemKey(item));
        }
      } else {
        agotados.push(getCartItemKey(item));
      }
    }
    setProductosAgotados(agotados);
  };

  const eliminarProductosAgotados = async () => {
    const nuevosAgotados = [];
    for (const item of cartItemsByCatalog) {
      const ref = getProductRef(item);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const { cantidad = 0, reservados = 0 } = snap.data();
        const stockDisponible = cantidad - reservados;
        if (stockDisponible <= 0 || stockDisponible < item.cantidad) {
          nuevosAgotados.push(getCartItemKey(item));
        }
      } else {
        nuevosAgotados.push(getCartItemKey(item));
      }
    }
    nuevosAgotados.forEach((cartKey) => {
      const producto = cartItemsByCatalog.find(
        (item) => getCartItemKey(item) === cartKey,
      );
      if (!producto) return;

      for (let i = 0; i < producto.cantidad; i += 1) {
        removeFromCart(producto);
      }
    });
    setProductosAgotados(nuevosAgotados);
    setError(null);
  };

  const validarStock = async () => {
    for (const item of cartItemsByCatalog) {
      const ref = getProductRef(item);
      const snap = await getDoc(ref);
      if (!snap.exists()) return `El producto "${item.titulo}" ya no existe.`;
      const { cantidad = 0, reservados = 0 } = snap.data();
      const stockDisponible = cantidad - reservados;
      if (stockDisponible < item.cantidad) {
        return `El producto "${item.titulo}" no tiene suficiente stock.`;
      }
    }
    return null;
  };

  const reservarProductos = async () => {
    for (const item of cartItemsByCatalog) {
      const ref = getProductRef(item);
      await updateDoc(ref, { reservados: increment(item.cantidad) });
    }
  };

  const guardarPedido = async (docId, fecha) => {
    const groupedItems = cartItemsByCatalog.reduce((acc, item) => {
      const collectionName = getProductCollectionName(item);

      if (!acc[collectionName]) {
        acc[collectionName] = [];
      }

      acc[collectionName].push(item);
      return acc;
    }, {});

    const saveTasks = Object.entries(groupedItems).map(
      ([collectionName, items]) => {
        const catalogKeyFromCollection =
          getCatalogKeyByCollectionName(collectionName);
        const catalogConfig = getCatalogConfig(catalogKeyFromCollection);
        const groupTotal = items.reduce(
          (acc, p) => acc + (Number(p.precio) || 0) * (Number(p.cantidad) || 0),
          0,
        );
        const pedido = {
          cliente: nombre,
          instagram: nombreInstagram,
          dni,
          telefono,
          correo,
          direccion: isArtlabPickup ? "Rosetti 93" : isRetiro ? "" : direccion,
          departamento,
          ciudad,
          codigoPostal,
          metodoEntrega,
          catalogo: catalogKeyFromCollection,
          productos: items.map((p) => ({
            titulo: p.titulo || "Producto sin nombre",
            categoria: p.categoria,
            coleccion: getProductCollectionName(p),
            imagen: p.imagen || "",
            autor: p.autor || "",
            cantidad: Number(p.cantidad) || 0,
            precioUnitario: Number(p.precio) || 0,
            subtotal: (Number(p.precio) || 0) * (Number(p.cantidad) || 0),
          })),
          total: groupTotal,
          fecha,
        };

        return setDoc(
          doc(db, catalogConfig.orderCollectionName, docId),
          pedido,
        );
      },
    );

    await Promise.all(saveTasks);
  };

  const generarDocId = (nombre) => {
    const now = new Date();
    const fechaId = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${now.getHours()}${now.getMinutes()}`;
    return `pedido-${normalizarNombre(nombre)}-${fechaId}`;
  };

  const handleClickOutside = (e) => {
    if (e.target === backdropRef.current) {
      handleClose();
    }
  };

  const cerrarModal = () => {
    setVisible(false);
    setTimeout(() => {
      onClose();
      setNombre("");
      setNombreInstagram("");
      setDni("");
      setTelefono("");
      setCorreo("");
      setDireccion("");
      setDepartamento("");
      setCiudad("");
      setCodigoPostal("");
      setError(null);
      setProductosAgotados([]);
      setPedidoId("");
      setFechaPedido("");
      setPedidoEnviado(false);
      setMensajeWsp("");
      setLoading(false);
      setUltimoTotal(0);
      localStorage.removeItem("ultimoTotalPedido");
    }, 200);
  };

  const handleClose = () => {
    if (pedidoEnviado) {
      setShowCloseConfirm(true); // solo si ya se generó el pedido
      return;
    }

    cerrarModalDefinitivo();
  };

  const cerrarModalDefinitivo = () => {
    setVisible(false);
    setTimeout(() => {
      onClose();
      setNombre("");
      setNombreInstagram("");
      setDni("");
      setTelefono("");
      setCorreo("");
      setDireccion("");
      setDepartamento("");
      setCiudad("");
      setCodigoPostal("");
      setError(null);
      setProductosAgotados([]);
      setPedidoId("");
      setFechaPedido("");
      setPedidoEnviado(false);
      setMensajeWsp("");
      setLoading(false);
      setUltimoTotal(0);
      localStorage.removeItem("ultimoTotalPedido");
    }, 200);
  };

  const enviarPedidoYRedirigirWsp = async () => {
    setLoading(true);
    setError(null);

    if (!metodoEntrega) {
      setError("Seleccioná un método de entrega.");
      setLoading(false);
      return;
    }

    if (cartItemsByCatalog.length === 0) {
      setError("No hay productos en el carrito para este pedido.");
      setLoading(false);
      return;
    }

    if (
      !isRetiro &&
      (!direccion.trim() || !ciudad.trim() || !codigoPostal.trim())
    ) {
      setError("Completá los datos de envío.");
      setLoading(false);
      return;
    }

    const docId = generarDocId(nombre);
    const fecha = new Intl.DateTimeFormat("es-AR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());

    try {
      const errorStock = await validarStock();
      if (errorStock) {
        setError(errorStock);
        setLoading(false);
        return;
      }

      await guardarPedido(docId, fecha);
      await reservarProductos();
      localStorage.setItem("ultimoTotalPedido", total.toString());
      checkoutCollectionNames.forEach((collectionName) => {
        clearCartByCollection(collectionName);
      });

      const formatPrice = (value) =>
        `$${(Number(value) || 0).toLocaleString("es-AR", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })}`;

      const groupedByCollection = cartItemsByCatalog.reduce((acc, item) => {
        const collectionName = getProductCollectionName(item);

        if (!acc[collectionName]) {
          acc[collectionName] = [];
        }

        acc[collectionName].push(item);
        return acc;
      }, {});

      const groupedProductLines = Object.entries(groupedByCollection)
        .map(([collectionName, items]) => {
          const itemCatalog = getCatalogConfig(
            getCatalogKeyByCollectionName(collectionName),
          );
          const sectionTitle = `\n${itemCatalog.label}:`;
          const lines = items.map((p) => {
            const quantity = Number(p?.cantidad) || 0;
            const unitPrice = Number(p?.precio) || 0;
            const subtotal = quantity * unitPrice;
            const title = p?.titulo || "Producto sin nombre";
            return `- ${quantity} x ${title} | Unitario: ${formatPrice(unitPrice)} | Subtotal: ${formatPrice(subtotal)}`;
          });
          const sectionTotal = items.reduce(
            (acc, p) =>
              acc + (Number(p?.precio) || 0) * (Number(p?.cantidad) || 0),
            0,
          );

          return [
            sectionTitle,
            ...lines,
            `Subtotal ${itemCatalog.label}: ${formatPrice(sectionTotal)}`,
          ].join("\n");
        })
        .join("\n");

      const mensajeWhatsApp = `
¡Hola BAWAX! Quiero confirmar este pedido.

🧾 Pedido: ${docId}
📅 Fecha: ${fecha}
🏷️ Origen: ${origenCompra}

👤 Cliente: ${nombre} - DNI ${dni}
📧 Email: ${correo}
📱 Teléfono: ${telefono}

${
  isArtlabPickup
    ? "🏠 Punto de retiro: Rosetti 93\n🕒 Horario: miercoles a sabados de 12:00 a 20:00hs"
    : !isRetiro
      ? `🏠 Dirección: ${direccion}${departamento ? `, (${departamento})` : ""}, ${ciudad} (${codigoPostal})`
      : ""
}

🛒 Detalle del pedido:${groupedProductLines}

💰 Total general: ${formatPrice(total)}

💳 Alias para transferir (${origenCompra}): ${aliasPago}

✅ Pedido reservado. Quedamos atentos al envio de comprobante de pago.
        `.trim();

      setPedidoEnviado(true);
      setPedidoId(docId);
      setFechaPedido(fecha);
      setMensajeWsp(mensajeWhatsApp);
      setUltimoTotal(total);
      setLoading(false);
    } catch (err) {
      setError("Hubo un error al enviar el pedido.");
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showCloseConfirm) {
      // Scroll al inicio del modal
      if (modalContentRef.current) {
        modalContentRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }

      // Bloquear scroll global y del modal
      document.body.style.overflow = "hidden";
      if (modalRef.current) {
        modalRef.current.style.overflow = "hidden";
      }
    } else {
      // Restaurar scroll global y del modal
      document.body.style.overflow = "";
      if (modalRef.current) {
        modalRef.current.style.overflow = "auto";
      }
    }

    return () => {
      document.body.style.overflow = "";
      if (modalRef.current) {
        modalRef.current.style.overflow = "auto";
      }
    };
  }, [showCloseConfirm]);

  return (
    <div
      className={`modal-backdrop ${visible ? "visible" : ""}`}
      ref={backdropRef}
      onClick={handleClickOutside}
    >
      <div
        className={`modal ${visible ? "fade-in" : "fade-out"}`}
        ref={modalRef}
      >
        <div className="modal-content" ref={modalContentRef}>
          <button className="close" onClick={handleClose}>
            ×
          </button>
          {pedidoEnviado ? (
            <>
              <div className="success-layout">
                <section className="success-main">
                  <p className="success-kicker">Pedido reservado</p>
                  <h2 className="modalTitle success-title">Listo, ya guardamos tu pedido</h2>
                  <p className="modalText success-subtitle">
                    Revisa estos datos y envia el mensaje para finalizar la compra.
                  </p>

                  <div className="success-id-card" role="status" aria-live="polite">
                    <p className="success-label">Pedido:</p>
                    <p className="success-id-value">{pedidoId}</p>
                  </div>

                  <div className="success-total-card">
                    <p className="success-label">Total:</p>
                    <p className="totalCheckout success-total-value">
                      $
                      {ultimoTotal.toLocaleString("es-AR", {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}
                    </p>
                  </div>
                </section>

                <aside className="success-actions">
                  <div className="info-box success-info-box">
                    Paso final: envia tu pedido por WhatsApp para completar la compra.
                  </div>

                  <p className="success-note">
                    Se abrira WhatsApp con el mensaje prearmado para confirmar.
                  </p>

                  <button
                    className="btn-whatsapp-succes"
                    onClick={() =>
                      window.open(
                        `https://wa.me/5491165825180?text=${encodeURIComponent(mensajeWsp)}`,
                        "_blank",
                      )
                    }
                  >
                    Enviar pedido por WhatsApp
                  </button>
                </aside>
              </div>

              <p className="modalText success-brand">Buenos Aires Wax</p>
            </>
          ) : (
            <>
              <h2 className="modalTitle">Resumen del pedido</h2>

              <div className="cart-columns">
                <div className="cart-left-panel">
                  <div className="product-list-wrapper">
                    <ul className="modal-product-list">
                      {cartItemsByCatalog.map((item) => (
                        <li
                          key={item.cartKey || getCartItemKey(item)}
                          className={`cart-item ${productosAgotados.includes(getCartItemKey(item)) ? "agotado" : ""}`}
                        >
                          <div className="cart-item__main">
                            <img className="cart-item__img" src={item.imagen} alt={item?.titulo || ""} />
                            <div className="cart-item__details">
                              <span className="cart-item__title">{item?.titulo || "Producto sin nombre"}</span>
                              <div className="cart-item__meta">
                                <span className="cart-item__price">
                                  ${((Number(item?.precio) || 0) * (Number(item?.cantidad) || 0)).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </span>
                                <span className="cart-item__qty">{Number(item?.cantidad) || 0}u</span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => removeFromCart(item)}
                            className="cart-item__remove"
                            title="Quitar del carrito"
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {productosAgotados.length > 0 && (
                    <>
                      <p className="productoAgotadoMensaje">
                        Algunos productos están agotados. Podés eliminarlos para
                        continuar.
                      </p>
                      <button
                        onClick={eliminarProductosAgotados}
                        className="btn-eliminar-agotados"
                      >
                        Eliminar productos agotados
                      </button>
                    </>
                  )}

                  <div className="totalContainer">
                    <span className="total-label">
                      Total ({totalProductos} {totalProductos === 1 ? "producto" : "productos"})
                    </span>
                    <span className="total-value">
                      ${total.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>

                <div className="cart-right-panel">
                  <p className="modalText">Formulario de Compra</p>

                  <form
                className="form"
                onSubmit={(e) => {
                  e.preventDefault();
                  enviarPedidoYRedirigirWsp();
                }}
              >
                <input
                  className="field-nombre"
                  type="text"
                  placeholder="Nombre completo"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                  disabled={loading}
                />
                <input
                  className="field-instagram"
                  type="text"
                  placeholder="Instagram @"
                  value={nombreInstagram}
                  onChange={(e) => setNombreInstagram(e.target.value)}
                  required
                  disabled={loading}
                />
                <input
                  className="field-email"
                  type="email"
                  placeholder="Email"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  required
                  disabled={loading}
                />
                <input
                  className="field-dni"
                  type="number"
                  placeholder="DNI"
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  required
                  disabled={loading}
                />
                <input
                  className="field-telefono"
                  type="tel"
                  placeholder="Teléfono"
                  value={telefono}
                  onChange={(e) =>
                    setTelefono(e.target.value.replace(/\D/g, ""))
                  }
                  required
                  disabled={loading}
                />

                <label className="metodo-entrega-label">
                  Método de entrega:
                  <select
                    value={metodoEntrega}
                    onChange={(e) => setMetodoEntrega(e.target.value)}
                    required
                    disabled={loading}
                  >
                    <option value="" disabled>
                      Seleccioná un medio de entrega
                    </option>
                    <option value="Envío a domicilio (Andreani)">
                      Envío a domicilio (Andreani)
                    </option>
                    <option value="artlab">Punto de retiro Artlab</option>
                  </select>
                </label>

                {metodoEntrega === "artlab" && (
                  <div className="pickup-info" role="status" aria-live="polite">
                    <p className="pickup-info-title">Punto de retiro Artlab</p>
                    <div className="pickup-info-row">
                      <span className="pickup-info-value">
                        Roseti 93, C1427 CABA
                      </span>
                    </div>
                    <div className="pickup-info-row">
                      <span className="pickup-info-value">
                        Miercoles a Sabados de 12:00 a 20:00hs
                      </span>
                    </div>
                  </div>
                )}

                {metodoEntrega === "Envío a domicilio (Andreani)" && (
                  <div className="shipping-fields">
                    <input
                      className="field-envio-calle"
                      type="text"
                      placeholder="Calle y numero"
                      value={direccion}
                      onChange={(e) => setDireccion(e.target.value)}
                      required
                      disabled={loading}
                    />
                    <input
                      className="field-envio-ciudad"
                      type="text"
                      placeholder="Ciudad"
                      value={ciudad}
                      onChange={(e) => setCiudad(e.target.value)}
                      required
                      disabled={loading}
                    />
                    <input
                      className="field-envio-cp"
                      type="text"
                      placeholder="Código Postal"
                      value={codigoPostal}
                      onChange={(e) => setCodigoPostal(e.target.value)}
                      required
                      disabled={loading}
                    />
                    <input
                      className="field-envio-depto"
                      type="text"
                      placeholder="Piso y Departamento (opcional)"
                      value={departamento}
                      onChange={(e) => setDepartamento(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                )}

                {error && <p className="form-error">{error}</p>}

                <button
                  className="btn-crear-orden"
                  type="submit"
                  disabled={
                    loading ||
                    productosAgotados.length > 0 ||
                    cartItemsByCatalog.length === 0
                  }
                >
                  {loading ? "Procesando..." : "Crear orden"}
                </button>

{/*                 <p className="modalText form-footer-text">
                  Su pedido será armado y aparecerá listo para ser enviado por
                  WhatsApp.
                </p> */}
              </form>
                </div>{/* cart-right-panel */}
              </div>{/* cart-columns */}
            </>
          )}

          {showCloseConfirm && (
            <div className={`confirm-overlay fade-in`}>
              <div className="confirm-box">
                <h3>Tu pedido fue generado.</h3>
                <p>
                  Recuerda completar los pasos anteriores para finalizar tu
                  compra
                </p>
                <p>
                  ⚠️{" "}
                  ⚠️
                </p>
                <div className="confirm-actions">
                  <button
                    className="btn-cancelar"
                    onClick={() => setShowCloseConfirm(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    className="btn-confirmar"
                    onClick={cerrarModalDefinitivo}
                  >
                    Sí, cerrar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PurchaseModal;
