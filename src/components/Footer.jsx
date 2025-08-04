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
                    href="https://wa.me/541130115436?text=Hola%20BaWax%2C%20tengo%20una%20consulta"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="contact-link"
                >
                    CONTACTO
                </a>
                <a className="email" href="https://mail.google.com/mail/?view=cm&fs=1&to=buenosaireswax@gmail.com&su=Consulta:&body=Hola%20Bawax,%20me%20gustaría%20hacer%20una%20consulta:%0A%0ANombre:%0ATeléfono:%0ADetalle%20de%20la%20consulta:" target="_blank" rel="noopener noreferrer">
                    buenosaireswax@gmail.com
                </a>

                <span className="footerAutor">Developed by eStock</span>
            </div>

            {mostrarFAQ && <FaqModal onClose={() => setMostrarFAQ(false)} />}
        </footer>
    );
}

export default Footer;