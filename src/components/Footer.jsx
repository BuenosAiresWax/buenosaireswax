import { useState } from "react";
import "../styles/Footer.css"
import FaqModal from "./FaqModal";

function Footer() {
    const [mostrarFAQ, setMostrarFAQ] = useState(false);

    return (
        <footer className="footer">
            <button onClick={() => setMostrarFAQ(true)} className="faq-link">
                Preguntas frecuentes
            </button>
            <p>Contacto:</p>
            <p>buenosaireswax@gmail.com</p>
            <a className="footerBtnWsp" href="https://wa.me/5491112345678?text=Hola%20BAWAX!%20" target="_blank">
                Ayuda
            </a>
            {mostrarFAQ && <FaqModal onClose={() => setMostrarFAQ(false)} />}
            <span>&copy; {new Date().getFullYear()}</span>
        </footer>
    );
}

export default Footer;
