import { useState } from "react";
import "../styles/Footer.css"
import FaqModal from "./FaqModal";

function Footer() {
    const [mostrarFAQ, setMostrarFAQ] = useState(false);

    return (
        <footer className="footer">
            <p>&copy; {new Date().getFullYear()} Buenos Aires Wax</p>
            <button onClick={() => setMostrarFAQ(true)} className="faq-link">
                Preguntas frecuentes
            </button>
            {mostrarFAQ && <FaqModal onClose={() => setMostrarFAQ(false)} />}
        </footer>
    );
}

export default Footer;
