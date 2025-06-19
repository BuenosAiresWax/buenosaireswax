import { useEffect, useState } from "react";
import "../styles/LoaderOverlay.css";
import logo from "../../assets/logo/logo-completo-negro.png"; // Ajustá el path si es necesario

const LoaderOverlay = ({ visible }) => {
    const [shouldRender, setShouldRender] = useState(visible);

    useEffect(() => {
        if (visible) {
            setShouldRender(true);
        } else {
            const timeout = setTimeout(() => setShouldRender(false), 800); // esperar la animación
            return () => clearTimeout(timeout);
        }
    }, [visible]);

    if (!shouldRender) return null;

    return (
        <div className={`loader-overlay ${!visible ? "hidden" : ""}`}>
            <div className="loader-content">
                <img src={logo} alt="Logo" className="loader-logo" />
                <div className="equalizer">
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        </div>
    );
};

export default LoaderOverlay;
