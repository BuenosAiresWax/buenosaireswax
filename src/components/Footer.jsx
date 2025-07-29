import { useState } from "react";

import FaqModal from "./FaqModal";

import logo from "../../assets/logo/header-logo.png";
import instagramIcon from "../../assets/icons/instagram.svg";

import "../styles/Footer.css";

function Footer() {
    const [mostrarFAQ, setMostrarFAQ] = useState(false);

    return (
        <footer className="footer">
            <div className="footer-left">
                <img src={logo} alt="BAWAX Logo" className="footer-logo" />
                <p className="footer-description">Online Vinyl Record Store</p>
                <a
                    href="https://www.instagram.com/buenosaireswax/"
                    target="_blank"
                    rel="noreferrer"
                >
                    <img
                        src={instagramIcon}
                        alt="Instagram"
                        className="footer-instagram"
                    />
                </a>
            </div>

            <div className="footer-right">
                <button onClick={() => setMostrarFAQ(true)} className="faq-link">
                    PREGUNTAS FRECUENTES
                </button>
                <a
                    href="https://wa.me/541130504515?text=Hola%20BaWax%2C%20tengo%20una%20consulta"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="contact-link"
                >
                    CONTACTO
                </a>
                <p className="email">buenosaireswax@gmail.com</p>
            </div>

            {mostrarFAQ && <FaqModal onClose={() => setMostrarFAQ(false)} />}
        </footer>
    );
}

export default Footer;
