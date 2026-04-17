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
const FILTERS_STORAGE_KEY = "bawax:product-list-filters";

const DEFAULT_FILTERS = {
  filtroTexto: "",
  generoSeleccionado: "",
  estiloSeleccionado: "",
  selloSeleccionado: "",
  autorSeleccionado: "",
  verDisponibles: false,
};

const getSavedFilters = () => {
  if (typeof window === "undefined") return DEFAULT_FILTERS;

  try {
    const raw = window.sessionStorage.getItem(FILTERS_STORAGE_KEY);

    if (!raw) return DEFAULT_FILTERS;

    const parsed = JSON.parse(raw);

    return {
      ...DEFAULT_FILTERS,
      ...parsed,
      verDisponibles: Boolean(parsed?.verDisponibles),
    };
  } catch {
    return DEFAULT_FILTERS;
  }
};

const ProductList = () => {
  const { cartItems } = useContext(CartContext);
  const initialFilters = useMemo(() => getSavedFilters(), []);

  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(BATCH_SIZE);

  const [filtroTexto, setFiltroTexto] = useState(initialFilters.filtroTexto);
  const [generoSeleccionado, setGeneroSeleccionado] = useState(
    initialFilters.generoSeleccionado,
  );
  const [estiloSeleccionado, setEstiloSeleccionado] = useState(
    initialFilters.estiloSeleccionado,
  );
  const [selloSeleccionado, setSelloSeleccionado] = useState(
    initialFilters.selloSeleccionado,
  );
  const [autorSeleccionado, setAutorSeleccionado] = useState(
    initialFilters.autorSeleccionado,
  );
  const [verDisponibles, setVerDisponibles] = useState(
    initialFilters.verDisponibles,
  );

  const [sidebarVisible, setSidebarVisible] = useState(false);

  const [isMobile, setIsMobile] = useState(false);

  const [estilosOpen, setEstilosOpen] = useState(true);
  const [generosOpen, setGenerosOpen] = useState(true);
  const [sellosOpen, setSellosOpen] = useState(false);
  const [autoresOpen, setAutoresOpen] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (sidebarVisible && isMobile) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [sidebarVisible, isMobile]);

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

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.sessionStorage.setItem(
      FILTERS_STORAGE_KEY,
      JSON.stringify({
        filtroTexto,
        generoSeleccionado,
        estiloSeleccionado,
        selloSeleccionado,
        autorSeleccionado,
        verDisponibles,
      }),
    );
  }, [
    filtroTexto,
    generoSeleccionado,
    estiloSeleccionado,
    selloSeleccionado,
    autorSeleccionado,
    verDisponibles,
  ]);

  /* -------------------------------
    FILTROS OPCIONES
    --------------------------------*/

  // 🔹 Función de orden personalizado: letras → números → símbolos
  const ordenarOpciones = (arr) =>
    arr.sort((a, b) => {
      const tipo = (str) => {
        if (/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(str)) return 1; // letras
        if (/^\d/.test(str)) return 2; // números
        return 3; // símbolos u otros
      };

      const tipoA = tipo(a);
      const tipoB = tipo(b);

      if (tipoA !== tipoB) return tipoA - tipoB;
      return a.localeCompare(b, "es", { sensitivity: "base" }); // orden alfabético
    });

  const generos = useMemo(() => ordenarOpciones([...new Set(productos.map((p) => p.genero).filter(Boolean))]), [productos]);
  const estilos = useMemo(() => ordenarOpciones([...new Set(productos.map((p) => p.estilo).filter(Boolean))]), [productos]);
  const sellos = useMemo(() => ordenarOpciones([...new Set(productos.map((p) => p.sello).filter(Boolean))]), [productos]);
  const autores = useMemo(() => ordenarOpciones([...new Set(productos.map((p) => p.autor).filter(Boolean))]), [productos]);

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
        generos={generos}
        estilos={estilos}
        sellos={sellos}
        autores={autores}
        sidebarVisible={sidebarVisible}
        setSidebarVisible={setSidebarVisible}
      />

      <div className="product-list-container">
        {sidebarVisible && isMobile && <div className="sidebar-overlay" onClick={() => setSidebarVisible(false)} />}
        <div className={`filters-sidebar ${sidebarVisible ? 'visible' : ''}`}>
            <div className="sidebar-filter">
              <button className="filter-toggle" onClick={() => setEstilosOpen(!estilosOpen)}>
                Estilos {estilosOpen ? '−' : '+'}
              </button>
              {estilosOpen && (
                <div className="filter-options">
                  <button
                    onClick={() => setEstiloSeleccionado("")}
                    className={estiloSeleccionado === "" ? "active" : ""}
                  >
                    Todos
                  </button>
                  {estilos.map((e) => (
                    <button
                      key={e}
                      onClick={() => setEstiloSeleccionado(e)}
                      className={estiloSeleccionado === e ? "active" : ""}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="sidebar-filter">
              <button className="filter-toggle" onClick={() => setGenerosOpen(!generosOpen)}>
                Géneros {generosOpen ? '−' : '+'}
              </button>
              {generosOpen && (
                <div className="filter-options">
                  <button
                    onClick={() => setGeneroSeleccionado("")}
                    className={generoSeleccionado === "" ? "active" : ""}
                  >
                    Todos
                  </button>
                  {generos.map((g) => (
                    <button
                      key={g}
                      onClick={() => setGeneroSeleccionado(g)}
                      className={generoSeleccionado === g ? "active" : ""}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="sidebar-filter">
              <button className="filter-toggle" onClick={() => setSellosOpen(!sellosOpen)}>
                Sellos {sellosOpen ? '−' : '+'}
              </button>
              {sellosOpen && (
                <div className="filter-options">
                  <button
                    onClick={() => setSelloSeleccionado("")}
                    className={selloSeleccionado === "" ? "active" : ""}
                  >
                    Todos
                  </button>
                  {sellos.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSelloSeleccionado(s)}
                      className={selloSeleccionado === s ? "active" : ""}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="sidebar-filter">
              <button className="filter-toggle" onClick={() => setAutoresOpen(!autoresOpen)}>
                Artistas {autoresOpen ? '−' : '+'}
              </button>
              {autoresOpen && (
                <div className="filter-options">
                  <button
                    onClick={() => setAutorSeleccionado("")}
                    className={autorSeleccionado === "" ? "active" : ""}
                  >
                    Todos
                  </button>
                  {autores.map((a) => (
                    <button
                      key={a}
                      onClick={() => setAutorSeleccionado(a)}
                      className={autorSeleccionado === a ? "active" : ""}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

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
      </div>

      <Notificacion mensaje={mensaje} visible={visible} />

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
