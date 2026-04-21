export const CATALOGS = {
  drop: {
    key: "drop",
    label: "Drops",
    description: "Lanzamientos mensuales con acceso exclusivo.",
    collectionName: "productos",
    orderCollectionName: "pedidos",
    listPath: "/",
    buildDetailPath: (id) => `/producto/${id}`,
  },
  tienda: {
    key: "tienda",
    label: "Tienda",
    description: "Catalogo abierto con discos disponibles todo el tiempo.",
    collectionName: "productosTienda",
    orderCollectionName: "pedidosTienda",
    listPath: "/tienda",
    buildDetailPath: (id) => `/tienda/producto/${id}`,
  },
  equipamiento: {
    key: "equipamiento",
    label: "Equipamiento",
    description: "Hardware, accesorios y herramientas para tu setup.",
    collectionName: "equipamiento",
    orderCollectionName: "pedidosEquipamiento",
    listPath: "/equipamiento",
    buildDetailPath: (id) => `/equipamiento/producto/${id}`,
  },
};

export function getCatalogConfig(catalogKey = "drop") {
  return CATALOGS[catalogKey] ?? CATALOGS.drop;
}

export function getProductCollectionName(producto) {
  if (producto?.collectionName) return producto.collectionName;
  if (producto?.catalogKey) return getCatalogConfig(producto.catalogKey).collectionName;
  return CATALOGS.drop.collectionName;
}

export function getCartItemKey(producto) {
  return `${getProductCollectionName(producto)}:${producto?.id ?? ""}`;
}

export function attachCatalogMeta(producto, catalogKey = "drop") {
  const catalog = getCatalogConfig(catalogKey);

  return {
    ...producto,
    catalogKey: catalog.key,
    collectionName: catalog.collectionName,
    detailPath: catalog.buildDetailPath(producto.id),
    cartKey: `${catalog.collectionName}:${producto.id}`,
  };
}