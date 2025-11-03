// src/components/AdminLogin.jsx
import { useState } from "react";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import "../styles/adminLogin.css"; // ⬅️ importamos los estilos

export default function AdminLogin() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const navigate = useNavigate();
    const auth = getAuth();

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            await signInWithEmailAndPassword(auth, email, password);
            navigate("/admin");
        } catch (err) {
            setError("Credenciales inválidas o error al iniciar sesión");
        }
    };

    return (
        <div className="admin-container">
            <form onSubmit={handleLogin} className="admin-card">
                <h2>Panel Admin</h2>
                <input
                    type="email"
                    placeholder="Correo"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
                <input
                    type="password"
                    placeholder="Contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
                {error && <p className="error-message">{error}</p>}
                <button type="submit">Iniciar sesión</button>
            </form>
        </div>
    );
}
