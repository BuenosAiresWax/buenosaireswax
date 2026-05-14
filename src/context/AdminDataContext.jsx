
import { createContext, useContext, useEffect, useState } from "react";
import { collection, getDocs, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import { normalizarFecha } from "../utils/fechas";
const AdminDataContext = createContext();


function mapDocs(snap, collectionName) {
    if (!snap || !snap.docs) return [];
    return snap.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            sourceCollection: collectionName,
            ...data,
            fechaObj: normalizarFecha(
                data.fecha ?? data.createdAt ?? data.created_at
            ),
        };
    }).sort((a, b) => (b.fechaObj ?? 0) - (a.fechaObj ?? 0));
}
export function AdminDataProvider({ children }) {
    const [pedidos, setPedidos] = useState([]);
    const [pedidosTienda, setPedidosTienda] = useState([]);
    const [pedidosEquipamiento, setPedidosEquipamiento] = useState([]);
    const [productos, setProductos] = useState([]);
    const [productosTienda, setProductosTienda] = useState([]);
    const [equipamiento, setEquipamiento] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [
                pedidosSnap,
                productosSnap,
                pedidosTiendaSnap,
                productosTiendaSnap,
                pedidosEquipamientoSnap,
                equipamientoProductosSnap,
                equipamientoLegacySnap,
            ] = await Promise.all([
                getDocs(collection(db, "pedidos")),
                getDocs(collection(db, "productos")),
                getDocs(collection(db, "pedidosTienda")),
                getDocs(collection(db, "productosTienda")),
                getDocs(collection(db, "pedidosEquipamiento")),
                getDocs(collection(db, "equipamiento")),
                getDocs(collection(db, "equipamiento")), // legacy collection
            ]);

            setPedidos(mapDocs(pedidosSnap, "pedidos"));
            setProductos(productosSnap.docs.map(doc => ({ 
                id: doc.id, 
                collectionName: "productos",
                catalogKey: "drop",
                ...doc.data() 
            })));
            setPedidosTienda(mapDocs(pedidosTiendaSnap, "pedidosTienda"));
            setProductosTienda(productosTiendaSnap.docs.map(doc => ({ 
                id: doc.id, 
                collectionName: "productosTienda",
                catalogKey: "tienda",
                ...doc.data() 
            })));
            setEquipamiento(equipamientoProductosSnap.docs.map(doc => ({ 
                id: doc.id, 
                collectionName: "equipamiento",
                catalogKey: "equipamiento",
                ...doc.data() 
            })));

            // Combinar pedidosEquipamiento + equipamiento legacy (solo los que tienen productos)
            const equipNuevo = mapDocs(pedidosEquipamientoSnap, "pedidosEquipamiento");
            const equipLegacy = mapDocs(equipamientoLegacySnap, "equipamiento")
                .filter(p => Array.isArray(p.productos) && p.productos.length > 0);

            setPedidosEquipamiento(
                [...equipNuevo, ...equipLegacy].sort((a, b) => b.fechaObj - a.fechaObj)
            );
        } catch (error) {
            console.error("Error cargando datos admin:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Cargar datos iniciales
        fetchAll();

        // Escuchar cambios en tiempo real para pedidos
        const unsubPedidos = onSnapshot(collection(db, "pedidos"), (snap) => {
            setPedidos(mapDocs(snap, "pedidos"));
        });

        const unsubPedidosTienda = onSnapshot(collection(db, "pedidosTienda"), (snap) => {
            setPedidosTienda(mapDocs(snap, "pedidosTienda"));
        });

        const unsubPedidosEquipamiento = onSnapshot(collection(db, "pedidosEquipamiento"), (snap) => {
            const equipNuevo = mapDocs(snap, "pedidosEquipamiento");
            setPedidosEquipamiento(
                [...equipNuevo].sort((a, b) => b.fechaObj - a.fechaObj)
            );
        });

        // Limpiar suscripciones al desmontar
        return () => {
            unsubPedidos();
            unsubPedidosTienda();
            unsubPedidosEquipamiento();
        };
    }, []);

    return (
        <AdminDataContext.Provider
            value={{
                pedidos,
                pedidosTienda,
                pedidosEquipamiento,
                productos,
                productosTienda,
                equipamiento,
                loading,
                refetch: fetchAll,
            }}
        >
            {children}
        </AdminDataContext.Provider>
    );
}

export const useAdminData = () => useContext(AdminDataContext);