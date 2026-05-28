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
import { attachCatalogMeta, getCatalogConfig } from "../utils/catalog";

import "../styles/ProductList.css";

const BATCH_SIZE = 15;
const MIN_LOADING_TIME = 800;
const FILTERS_STORAGE_KEY = "bawax:product-list-filters";
const FILTER_PLACEHOLDER_COUNT = 4;

const DEFAULT_FILTERS = {
  filtroTexto: "",
  categoriaSeleccionada: "",
  generoSeleccionado: "",
  estiloSeleccionado: "",
  selloSeleccionado: "",
  autorSeleccionado: "",
  verDisponibles: false,
  verSale: false,
};

const normalizeFilterValue = (value) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const normalizeCategoryToken = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const isSaleCategory = (value) => normalizeFilterValue(value) === "sale";

const isHiddenSidebarCategory = (value) => {
  const normalized = normalizeCategoryToken(value);
  return normalized === "vinilo" || normalized === "sin categoria";
};

const isSameFilterValue = (leftValue, rightValue) =>
  normalizeFilterValue(leftValue) === normalizeFilterValue(rightValue);

const getSavedFilters = (storageKey) => {
  if (typeof window === "undefined") return DEFAULT_FILTERS;

  try {
    const raw = window.sessionStorage.getItem(storageKey);

    if (!raw) return DEFAULT_FILTERS;

    const parsed = JSON.parse(raw);

    return {
      ...DEFAULT_FILTERS,
      ...parsed,
      verDisponibles: Boolean(parsed?.verDisponibles),
      verSale: Boolean(parsed?.verSale),
    };
  } catch {
    return DEFAULT_FILTERS;
  }
};

const ProductList = ({ catalogKey = "drop" }) => {
  const { cartItems } = useContext(CartContext);
  const catalog = useMemo(() => getCatalogConfig(catalogKey), [catalogKey]);
  const filtersStorageKey = `${FILTERS_STORAGE_KEY}:${catalog.key}`;
  const initialFilters = useMemo(
    () => getSavedFilters(filtersStorageKey),
    [filtersStorageKey],
  );

  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(BATCH_SIZE);

  const [filtroTexto, setFiltroTexto] = useState(initialFilters.filtroTexto);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(
    initialFilters.categoriaSeleccionada,
  );
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
  const [verSale, setVerSale] = useState(initialFilters.verSale);

  const [sidebarVisible, setSidebarVisible] = useState(false);

  const [isMobile, setIsMobile] = useState(false);

  const [categoriasOpen, setCategoriasOpen] = useState(true);
  const [estilosOpen, setEstilosOpen] = useState(false);
  const [generosOpen, setGenerosOpen] = useState(true);
  const [sellosOpen, setSellosOpen] = useState(false);
  const [autoresOpen, setAutoresOpen] = useState(false);

  useEffect(() => {
    const savedFilters = getSavedFilters(filtersStorageKey);

    setFiltroTexto(savedFilters.filtroTexto);
    setCategoriaSeleccionada(savedFilters.categoriaSeleccionada);
    setGeneroSeleccionado(savedFilters.generoSeleccionado);
    setEstiloSeleccionado(savedFilters.estiloSeleccionado);
    setSelloSeleccionado(savedFilters.selloSeleccionado);
    setAutorSeleccionado(savedFilters.autorSeleccionado);
    setVerDisponibles(savedFilters.verDisponibles);
    setVerSale(savedFilters.verSale);
    setLimit(BATCH_SIZE);
    setSidebarVisible(false);
  }, [filtersStorageKey]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile) {
      setCategoriasOpen(true);
      setGenerosOpen(true);
      setEstilosOpen(false);
      setSellosOpen(false);
      setAutoresOpen(false);
      return;
    }

    setCategoriasOpen(true);
    setGenerosOpen(true);
    setEstilosOpen(false);
    setSellosOpen(false);
    setAutoresOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const shouldLockScroll = sidebarVisible && isMobile;

    document.body.classList.toggle("mobile-filters-open", shouldLockScroll);
    document.documentElement.classList.toggle(
      "mobile-filters-open",
      shouldLockScroll,
    );

    return () => {
      document.body.classList.remove("mobile-filters-open");
      document.documentElement.classList.remove("mobile-filters-open");
    };
  }, [sidebarVisible, isMobile]);

  const applySidebarFilter = useCallback((setter, value) => {
    setter(value);

    if (isMobile) {
      setSidebarVisible(false);
    }
  }, [isMobile]);

  const { mensaje, visible, mostrarMensaje } = useNotificacion(1000);

  const sentinelRef = useRef();
  const productListContainerRef = useRef(null);
  const hasMountedCategoryFiltersRef = useRef(false);
  const loadingStartRef = useRef(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const scrollToProductsTop = useCallback(() => {
    if (typeof window === "undefined") return;

    const container = productListContainerRef.current;
    const filtersContainer = document.querySelector(".filters-container");

    if (!container) return;

    const stickyOffset =
      isMobile && filtersContainer
        ? filtersContainer.getBoundingClientRect().height + 16
        : 12;

    const top = container.getBoundingClientRect().top + window.scrollY - stickyOffset;

    window.scrollTo({
      top: Math.max(0, top),
      behavior: "smooth",
    });
  }, [isMobile]);

  /* -------------------------------
    FIREBASE
    --------------------------------*/

  useEffect(() => {
    setLoading(true);

    const unsubscribe = onSnapshot(collection(db, catalog.collectionName), (snapshot) => {
      const productosActualizados = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })).map((producto) => attachCatalogMeta(producto, catalog.key));

      setProductos(productosActualizados);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [catalog.collectionName, catalog.key]);

  useEffect(() => {
    if (cartItems.length === 0) {
      mostrarMensaje("Carrito vacío");
    }
  }, [cartItems, mostrarMensaje]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.sessionStorage.setItem(
      filtersStorageKey,
      JSON.stringify({
        filtroTexto,
        categoriaSeleccionada,
        generoSeleccionado,
        estiloSeleccionado,
        selloSeleccionado,
        autorSeleccionado,
        verDisponibles,
        verSale,
      }),
    );
  }, [
    filtroTexto,
    categoriaSeleccionada,
    generoSeleccionado,
    estiloSeleccionado,
    selloSeleccionado,
    autorSeleccionado,
    verDisponibles,
    verSale,
    filtersStorageKey,
  ]);

  useEffect(() => {
    if (!hasMountedCategoryFiltersRef.current) {
      hasMountedCategoryFiltersRef.current = true;
      return;
    }

    scrollToProductsTop();
  }, [
    categoriaSeleccionada,
    generoSeleccionado,
    estiloSeleccionado,
    selloSeleccionado,
    autorSeleccionado,
    scrollToProductsTop,
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

  const getUniqueFilterOptions = useCallback(
    (field) => {
      const optionsMap = new Map();

      productos.forEach((producto) => {
        const rawValue = producto?.[field];
        const displayValue = String(rawValue ?? "")
          .trim()
          .replace(/\s+/g, " ");
        const normalizedValue = normalizeFilterValue(rawValue);

        if (!normalizedValue || optionsMap.has(normalizedValue)) {
          return;
        }

        optionsMap.set(normalizedValue, displayValue);
      });

      return ordenarOpciones([...optionsMap.values()]);
    },
    [productos],
  );

  const generos = useMemo(() => getUniqueFilterOptions("genero"), [getUniqueFilterOptions]);
  const categorias = useMemo(
    () =>
      getUniqueFilterOptions("categoria").filter(
        (categoria) => !isHiddenSidebarCategory(categoria),
      ),
    [getUniqueFilterOptions],
  );
  const estilos = useMemo(() => getUniqueFilterOptions("estilo"), [getUniqueFilterOptions]);
  const sellos = useMemo(() => getUniqueFilterOptions("sello"), [getUniqueFilterOptions]);
  const autores = useMemo(() => getUniqueFilterOptions("autor"), [getUniqueFilterOptions]);

  /* -------------------------------
    FILTROS
    --------------------------------*/

  const productosFiltrados = useMemo(() => {
    const filtrados = productos
      .map((producto) => ({
        ...producto,
        titulo: producto.titulo?.trim() || "",
        sello: String(producto.sello ?? "").trim().replace(/\s+/g, " "),
        autor: String(producto.autor ?? "").trim().replace(/\s+/g, " "),
        genero: String(producto.genero ?? "").trim().replace(/\s+/g, " "),
        estilo: String(producto.estilo ?? "").trim().replace(/\s+/g, " "),
      }))
      .filter((producto) => {
        const textoBusqueda = filtroTexto.toLowerCase();
        const coincideTexto =
          !filtroTexto ||
          (producto.titulo || "").toLowerCase().includes(textoBusqueda) ||
          (producto.autor || "").toLowerCase().includes(textoBusqueda) ||
          (producto.sello || "").toLowerCase().includes(textoBusqueda) ||
          (producto.genero || "").toLowerCase().includes(textoBusqueda) ||
          (producto.estilo || "").toLowerCase().includes(textoBusqueda);

        const coincideGenero =
          !generoSeleccionado ||
          normalizeFilterValue(producto.genero) ===
            normalizeFilterValue(generoSeleccionado);
        const coincideCategoria =
          !categoriaSeleccionada ||
          normalizeFilterValue(producto.categoria) ===
            normalizeFilterValue(categoriaSeleccionada);
        const coincideEstilo =
          !estiloSeleccionado ||
          normalizeFilterValue(producto.estilo) ===
            normalizeFilterValue(estiloSeleccionado);
        const coincideSello =
          !selloSeleccionado ||
          normalizeFilterValue(producto.sello) ===
            normalizeFilterValue(selloSeleccionado);
        const coincideAutor =
          !autorSeleccionado ||
          normalizeFilterValue(producto.autor) ===
            normalizeFilterValue(autorSeleccionado);

        const stockDisponible =
          (producto.cantidad ?? 0) - (producto.reservados ?? 0) > 0;

        const coincideStock = !verDisponibles || stockDisponible;
        const coincideSale = !verSale || isSaleCategory(producto.categoria);

        return (
          coincideTexto &&
          coincideCategoria &&
          coincideGenero &&
          coincideEstilo &&
          coincideSello &&
          coincideAutor &&
          coincideStock &&
          coincideSale
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
    categoriaSeleccionada,
    generoSeleccionado,
    estiloSeleccionado,
    selloSeleccionado,
    autorSeleccionado,
    verDisponibles,
    verSale,
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

            url: `${window.location.origin}/#${producto.detailPath}`,

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

                url: `${window.location.origin}/#${producto.detailPath}`,
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
      <div>
        <div className="filters-container filters-container-placeholder" aria-hidden="true">
          <div className="filters-group">
            <div className="search-input-container filters-item filters-placeholder-search">
              <span className="filters-placeholder-icon filters-placeholder-shimmer" />
              <span className="filters-placeholder-input filters-placeholder-shimmer" />
            </div>

            <div className="filters-actions filters-actions-placeholder">
              <div className="filters-action-btn filters-placeholder-block filters-placeholder-shimmer filters-placeholder-mobile-toggle" />
              <div className="filters-action-btn filters-placeholder-block filters-placeholder-shimmer filters-placeholder-availability" />
              <div className="filters-action-btn filters-placeholder-block filters-placeholder-shimmer filters-placeholder-clear" />
            </div>
          </div>
        </div>

        <div className="product-list-container">
          <div className="filters-sidebar filters-sidebar-placeholder" aria-hidden="true">
            {Array.from({ length: FILTER_PLACEHOLDER_COUNT }).map((_, index) => (
              <div key={index} className="sidebar-placeholder-section">
                <div className="sidebar-placeholder-title filters-placeholder-shimmer" />
                <div className="sidebar-placeholder-row filters-placeholder-shimmer" />
                <div className="sidebar-placeholder-row filters-placeholder-shimmer" />
                <div className="sidebar-placeholder-row filters-placeholder-shimmer" />
              </div>
            ))}
          </div>

          <div className="product-list">
            {[1, 2, 3].map((_, i) => (
              <ProductSkeleton key={i} />
            ))}
          </div>
        </div>
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
        categoriaSeleccionada={categoriaSeleccionada}
        setCategoriaSeleccionada={setCategoriaSeleccionada}
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
        verSale={verSale}
        setVerSale={setVerSale}
        productos={productos}
        categorias={categorias}
        generos={generos}
        estilos={estilos}
        sellos={sellos}
        autores={autores}
        sidebarVisible={sidebarVisible}
        setSidebarVisible={setSidebarVisible}
      />

      <div className="product-list-container" ref={productListContainerRef}>
        {sidebarVisible && isMobile && <div className="sidebar-overlay" onClick={() => setSidebarVisible(false)} />}
        <div className={`filters-sidebar ${sidebarVisible ? 'visible' : ''}`}>
            <div className="sidebar-filter">
              <button className="filter-toggle" onClick={() => setCategoriasOpen(!categoriasOpen)}>
                Categorías {categoriasOpen ? '−' : '+'}
              </button>
              {categoriasOpen && (
                <div className="filter-options">
                  <button
                    onClick={() => applySidebarFilter(setCategoriaSeleccionada, "")}
                    className={categoriaSeleccionada === "" ? "active" : ""}
                  >
                    Todas
                  </button>
                  {categorias.map((c) => (
                    <button
                      key={c}
                      onClick={() => applySidebarFilter(setCategoriaSeleccionada, c)}
                      className={isSameFilterValue(categoriaSeleccionada, c) ? "active" : ""}
                    >
                      {c}
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
                    onClick={() => applySidebarFilter(setGeneroSeleccionado, "")}
                    className={generoSeleccionado === "" ? "active" : ""}
                  >
                    Todos
                  </button>
                  {generos.map((g) => (
                    <button
                      key={g}
                      onClick={() => applySidebarFilter(setGeneroSeleccionado, g)}
                      className={isSameFilterValue(generoSeleccionado, g) ? "active" : ""}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="sidebar-filter">
              <button className="filter-toggle" onClick={() => setEstilosOpen(!estilosOpen)}>
                Estilos {estilosOpen ? '−' : '+'}
              </button>
              {estilosOpen && (
                <div className="filter-options">
                  <button
                    onClick={() => applySidebarFilter(setEstiloSeleccionado, "")}
                    className={estiloSeleccionado === "" ? "active" : ""}
                  >
                    Todos
                  </button>
                  {estilos.map((e) => (
                    <button
                      key={e}
                      onClick={() => applySidebarFilter(setEstiloSeleccionado, e)}
                      className={isSameFilterValue(estiloSeleccionado, e) ? "active" : ""}
                    >
                      {e}
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
                    onClick={() => applySidebarFilter(setSelloSeleccionado, "")}
                    className={selloSeleccionado === "" ? "active" : ""}
                  >
                    Todos
                  </button>
                  {sellos.map((s) => (
                    <button
                      key={s}
                      onClick={() => applySidebarFilter(setSelloSeleccionado, s)}
                      className={isSameFilterValue(selloSeleccionado, s) ? "active" : ""}
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
                    onClick={() => applySidebarFilter(setAutorSeleccionado, "")}
                    className={autorSeleccionado === "" ? "active" : ""}
                  >
                    Todos
                  </button>
                  {autores.map((a) => (
                    <button
                      key={a}
                      onClick={() => applySidebarFilter(setAutorSeleccionado, a)}
                      className={isSameFilterValue(autorSeleccionado, a) ? "active" : ""}
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
