// src/components/AdminRoute.jsx
import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import AdminLogin from "./AdminLogin";
import AdminDashboard from "./AdminDashboard";
import "../styles/admin.css"; // ⬅️ importamos los estilos

export default function AdminRoute() {
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

    return user ? <AdminDashboard /> : <AdminLogin />;
}
