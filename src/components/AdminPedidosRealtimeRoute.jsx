import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import AdminLogin from "./AdminLogin";
import AdminPedidosCatalogos from "./AdminPedidosCatalogos";
import "../styles/admin.css";

export default function AdminPedidosRealtimeRoute() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const auth = getAuth();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return unsubscribe;
    }, [auth]);

    if (loading) return <p className="admin-loader">Cargando...</p>;

    return user ? <AdminPedidosCatalogos /> : <AdminLogin />;
}
