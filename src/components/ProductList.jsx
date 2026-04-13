import {
  useContext,
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { CartContext } from "../context/CartContext";
import { useNotificacion } from "../hooks/useNotificacion";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import ProductItem from "./ProductItem";
import ProductSkeleton from "./ProductSkeleton";
import Filters from "./Filters";
import Notificacion from "./Notificacion";
import Spinner from "./Spinner";
import YouTubePopup from "./YouTubePopup";

import "../styles/ProductList.css";

const BATCH_SIZE = 15;
const MIN_LOADING_TIME = 800;

const ProductList = () => {
  const { cartItems } = useContext(CartContext);

  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(BATCH_SIZE);

  const [filtroTexto, setFiltroTexto] = useState("");
  const [generoSeleccionado, setGeneroSeleccionado] = useState("");
  const [estiloSeleccionado, setEstiloSeleccionado] = useState("");
  const [selloSeleccionado, setSelloSeleccionado] = useState("");
  const [autorSeleccionado, setAutorSeleccionado] = useState("");
  const [verDisponibles, setVerDisponibles] = useState(false);

  const { mensaje, visible, mostrarMensaje } = useNotificacion(1000);

  const sentinelRef = useRef();
  const loadingStartRef = useRef(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  /* -------------------------------
    FIREBASE
    --------------------------------*/

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "productos"), (snapshot) => {
      const productosActualizados = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setProductos(productosActualizados);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (cartItems.length === 0) {
      mostrarMensaje("Carrito vacío");
    }
  }, [cartItems, mostrarMensaje]);

  /* -------------------------------
    FILTROS
    --------------------------------*/

  const productosFiltrados = useMemo(() => {
    const filtrados = productos
      .map((producto) => ({
        ...producto,
        titulo: producto.titulo?.trim() || "",
        sello: producto.sello?.trim() || "",
        autor: producto.autor?.trim() || "",
        genero: producto.genero?.trim() || "",
        estilo: producto.estilo?.trim() || "",
      }))
      .filter((producto) => {
        const coincideTexto = (producto.titulo || "")
          .toLowerCase()
          .includes(filtroTexto.toLowerCase());

        const coincideGenero =
          !generoSeleccionado || producto.genero === generoSeleccionado;
        const coincideEstilo =
          !estiloSeleccionado || producto.estilo === estiloSeleccionado;
        const coincideSello =
          !selloSeleccionado || producto.sello === selloSeleccionado;
        const coincideAutor =
          !autorSeleccionado || producto.autor === autorSeleccionado;

        const stockDisponible =
          (producto.cantidad ?? 0) - (producto.reservados ?? 0) > 0;

        const coincideStock = !verDisponibles || stockDisponible;

        return (
          coincideTexto &&
          coincideGenero &&
          coincideEstilo &&
          coincideSello &&
          coincideAutor &&
          coincideStock
        );
      });

    const normalizar = (str) => {
      if (!str) return "";
      return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
    };

    const prioridadSello = (sello) => {
      if (!sello) return "zzz";

      const limpio = normalizar(sello);

      return /^[a-z0-9]/.test(limpio) ? limpio : "zzz" + limpio;
    };

    filtrados.sort((a, b) => {
      const selloA = prioridadSello(a.sello);
      const selloB = prioridadSello(b.sello);

      const selloComp = selloA.localeCompare(selloB, "es", {
        sensitivity: "base",
      });

      if (selloComp !== 0) return selloComp;

      return normalizar(a.titulo).localeCompare(normalizar(b.titulo), "es", {
        sensitivity: "base",
      });
    });

    return filtrados;
  }, [
    productos,
    filtroTexto,
    generoSeleccionado,
    estiloSeleccionado,
    selloSeleccionado,
    autorSeleccionado,
    verDisponibles,
  ]);

  const productosLimitados = productosFiltrados.slice(0, limit);

  /* -------------------------------
    SCHEMA STRUCTURED DATA
    --------------------------------*/

  useEffect(() => {
    if (!productosLimitados.length) return;

    const schema = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",

      name: "Buenos Aires Wax",

      mainEntity: {
        "@type": "ItemList",

        itemListElement: productosLimitados.map((producto, index) => {
          const stockDisponible =
            (producto.cantidad ?? 0) - (producto.reservados ?? 0) > 0;

          return {
            "@type": "ListItem",

            position: index + 1,

            url: `${window.location.origin}/#producto-${producto.id}`,

            item: {
              "@type": "Product",

              "@id": `#producto-${producto.id}`,

              name: producto.titulo,

              image: producto.imagen ? [producto.imagen] : [],

              description: `${producto.descripcion || ""} ${producto.estilo || ""}`,

              sku: producto.id,

              brand: {
                "@type": "Brand",
                name: producto.sello || "Unknown",
              },

              additionalProperty: [
                {
                  "@type": "PropertyValue",
                  name: "Format",
                  value: "Vinyl",
                },
              ],

              isRelatedTo: {
                "@type": "MusicAlbum",

                name: producto.titulo,

                byArtist: {
                  "@type": "MusicGroup",
                  name: producto.autor || "Unknown Artist",
                },

                genre: producto.genero || "Electronic",

                recordLabel: {
                  "@type": "Organization",
                  name: producto.sello || "Unknown Label",
                },
              },

              offers: {
                "@type": "Offer",

                priceCurrency: "ARS",

                price: producto.precio ?? 0,

                availability: stockDisponible
                  ? "https://schema.org/InStock"
                  : "https://schema.org/OutOfStock",

                url: `${window.location.origin}/#producto-${producto.id}`,
              },
            },
          };
        }),
      },
    };

    const script = document.createElement("script");

    script.type = "application/ld+json";
    script.innerHTML = JSON.stringify(schema);

    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, [productosLimitados]);

  /* -------------------------------
    INFINITE SCROLL
    --------------------------------*/

  const cargarMas = useCallback(
    (node) => {
      if (sentinelRef.current) sentinelRef.current.disconnect();

      sentinelRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !isLoadingMore) {
          setIsLoadingMore(true);

          loadingStartRef.current = Date.now();

          setTimeout(() => {
            setLimit((prev) =>
              Math.min(prev + BATCH_SIZE, productosFiltrados.length),
            );

            const elapsed = Date.now() - loadingStartRef.current;

            const remaining = MIN_LOADING_TIME - elapsed;

            if (remaining > 0) {
              setTimeout(() => setIsLoadingMore(false), remaining);
            } else {
              setIsLoadingMore(false);
            }
          }, 500);
        }
      });

      if (node) sentinelRef.current.observe(node);
    },
    [productosFiltrados.length, isLoadingMore],
  );

  /* -------------------------------
    LOADING
    --------------------------------*/

  if (loading) {
    return (
      <div className="product-list">
        {[1, 2, 3].map((_, i) => (
          <ProductSkeleton key={i} />
        ))}
      </div>
    );
  }

  /* -------------------------------
    RENDER
    --------------------------------*/

  return (
    <div>
      <Filters
        filtroTexto={filtroTexto}
        setFiltroTexto={setFiltroTexto}
        generoSeleccionado={generoSeleccionado}
        setGeneroSeleccionado={setGeneroSeleccionado}
        estiloSeleccionado={estiloSeleccionado}
        setEstiloSeleccionado={setEstiloSeleccionado}
        selloSeleccionado={selloSeleccionado}
        setSelloSeleccionado={setSelloSeleccionado}
        autorSeleccionado={autorSeleccionado}
        setAutorSeleccionado={setAutorSeleccionado}
        verDisponibles={verDisponibles}
        setVerDisponibles={setVerDisponibles}
        productos={productos}
      />

      <Notificacion mensaje={mensaje} visible={visible} />

      <div className="product-list">
        {productosLimitados.length === 0 ? (
          <div className="product-item no-results">
            <div className="info">
              <h2>Ups!</h2>
              <p>Seguinos en redes y no te pierdas nuestros drops.</p>
            </div>
          </div>
        ) : (
          productosLimitados.map((producto) => (
            <ProductItem
              key={producto.id}
              producto={producto}
              mostrarMensaje={mostrarMensaje}
            />
          ))
        )}
      </div>

      <YouTubePopup />

      {isLoadingMore && (
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <Spinner />
        </div>
      )}

      {!isLoadingMore && limit < productosFiltrados.length && (
        <div ref={cargarMas} style={{ height: "1px" }} />
      )}
    </div>
  );
};

export default ProductList;
