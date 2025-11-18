// src/components/AdminLogin.jsx
import { useState } from "react";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import "../styles/adminLogin.css";

// ⬅️ IMPORTA TU LOGO LOCAL
import logo from "../../assets/logo/header-logo.png";
import bg from "../../assets/logo/favicon.png";


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
            setError("Credenciales inválidas");
        }
    };

    return (
        <div className="login-wrapper">
            <form className="login-card" onSubmit={handleLogin}>

                {/* LOGO */}
                <img src={logo} alt="Logo" className="login-logo" />

                <h2 className="login-title">Panel Administrativo</h2>

                <div className="input-group">
                    <span className="input-icon">📧</span>
                    <input
                        type="email"
                        placeholder="Usuario"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>

                <div className="input-group">
                    <span className="input-icon">🔑</span>
                    <input
                        type="password"
                        placeholder="Contraseña"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>

                {error && <p className="login-error">{error}</p>}

                <button type="submit" className="login-btn">
                    Iniciar sesión
                </button>
            </form>
        </div>
    );
}
