import { createContext, useContext, useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import { normalizarFecha } from "../utils/fechas";

const AdminDataContext = createContext();

export function AdminDataProvider({ children }) {
    const [pedidos, setPedidos] = useState([]);
    const [productos, setProductos] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [pedidosSnap, productosSnap] = await Promise.all([
                getDocs(collection(db, "pedidos")),
                getDocs(collection(db, "productos")),
            ]);

            const pedidosData = pedidosSnap.docs
                .map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data,
                        fechaObj: normalizarFecha(
                            data.fecha ?? data.createdAt ?? data.created_at
                        ),
                    };
                })
                .sort((a, b) => b.fechaObj - a.fechaObj);

            const productosData = productosSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));

            setPedidos(pedidosData);
            setProductos(productosData);
        } catch (error) {
            console.error("Error cargando datos admin:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAll();
    }, []);

    return (
        <AdminDataContext.Provider
            value={{
                pedidos,
                productos,
                loading,
                refetch: fetchAll,
            }}
        >
            {children}
        </AdminDataContext.Provider>
    );
}

export const useAdminData = () => useContext(AdminDataContext);