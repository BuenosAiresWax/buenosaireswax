// src/components/PedidosAdmin.jsx
import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import "../styles/admin.css";

// Mapeo de meses en español a número
const meses = {
    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
    julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11
};

// Función para convertir string "5 de octubre de 2025, 08:26 p. m." a Date
function parseFecha(fechaStr) {
    if (!fechaStr) return new Date(0);

    const [diaMes, tiempo] = fechaStr.split(", "); // ["5 de octubre de 2025", "08:26 p. m."]
    const [dia, , mes, , año] = diaMes.split(" "); // ["5", "de", "octubre", "de", "2025"]

    let [hora, min] = tiempo.split(":"); // ["08", "26 p. m."]
    let pm = false;

    if (min.includes("p. m.")) {
        pm = true;
        min = min.replace(" p. m.", "");
    } else {
        min = min.replace(" a. m.", "");
    }

    hora = parseInt(hora);
    min = parseInt(min);

    if (pm && hora < 12) hora += 12;
    if (!pm && hora === 12) hora = 0;

    return new Date(parseInt(año), meses[mes.toLowerCase()], parseInt(dia), hora, min);
}

export default function PedidosAdmin() {
    const [pedidos, setPedidos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [orden, setOrden] = useState("masReciente"); // masReciente o menosReciente

    const fetchPedidos = async () => {
        setLoading(true);
        try {
            const pedidosRef = collection(db, "pedidos");
            const snapshot = await getDocs(pedidosRef);
            const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Parsear fechas
            const pedidosConFecha = docs.map(p => ({
                ...p,
                fechaObj: parseFecha(p.fecha)
            }));

            // Ordenar
            pedidosConFecha.sort((a, b) => b.fechaObj - a.fechaObj);

            setPedidos(pedidosConFecha);
        } catch (error) {
            console.error("Error al cargar pedidos:", error);
        } finally {
            setLoading(false);
        }
    };

    // Recarga automática al montar
    useEffect(() => {
        fetchPedidos();
    }, []);

    // Manejar cambio de orden
    const handleOrdenChange = (e) => {
        const nuevoOrden = e.target.value;
        setOrden(nuevoOrden);

        const pedidosOrdenados = [...pedidos].sort((a, b) =>
            nuevoOrden === "masReciente" ? b.fechaObj - a.fechaObj : a.fechaObj - b.fechaObj
        );
        setPedidos(pedidosOrdenados);
    };

    if (loading) return <p className="admin-loader">Cargando pedidos...</p>;

    return (
        <div>
            {/* Controles de orden y refresh */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginBottom: "1rem" }}>
                <select value={orden} onChange={handleOrdenChange} style={{ padding: "0.3rem", borderRadius: "5px" }}>
                    <option value="masReciente">Más reciente primero</option>
                    <option value="menosReciente">Menos reciente primero</option>
                </select>
                <button onClick={fetchPedidos} style={{ padding: "0.3rem 0.6rem", borderRadius: "5px", cursor: "pointer" }}>
                    🔄 Refresh
                </button>
            </div>

            <div className="cards-container">
                {pedidos.length === 0 ? (
                    <p>No hay pedidos registrados.</p>
                ) : (
                    pedidos.map((pedido) => (
                        <div key={pedido.id} className="pedido-card">
                            <div className="pedido-header">
                                <h3>{pedido.cliente}</h3>
                                <span className="pedido-fecha">{pedido.fecha}</span>
                            </div>

                            <div className="pedido-section">
                                <h4>📦 Detalles del pedido</h4>
                                <div className="pedido-row">
                                    <span className="label">Correo</span>
                                    <span className="dots"></span>
                                    <span className="value">{pedido.correo}</span>
                                </div>
                                <div className="pedido-row">
                                    <span className="label">Teléfono</span>
                                    <span className="dots"></span>
                                    <span className="value">{pedido.telefono}</span>
                                </div>
                                <div className="pedido-row">
                                    <span className="label">Método de entrega</span>
                                    <span className="dots"></span>
                                    <span className="value">{pedido.metodoEntrega}</span>
                                </div>
                                <div className="pedido-row">
                                    <span className="label">Instagram</span>
                                    <span className="dots"></span>
                                    <span className="value">{pedido.instagram}</span>
                                </div>
                                <div className="pedido-row total">
                                    <span className="label">Total</span>
                                    <span className="dots"></span>
                                    <span className="value">${pedido.total}</span>
                                </div>
                            </div>

                            <div className="pedido-section productos">
                                <h4>🛍️ Productos</h4>
                                {pedido.productos?.map((prod, idx) => (
                                    <div className="pedido-row" key={idx}>
                                        <span className="label">{prod.titulo}</span>
                                        <span className="dots"></span>
                                        <span className="value">
                                            {prod.cantidad} x ${prod.precioUnitario} = ${prod.subtotal}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
