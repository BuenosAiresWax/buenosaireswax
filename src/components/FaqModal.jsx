import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "../styles/FaqModal.css";

const preguntas = [
    {
        pregunta: "¿Dónde puedo hacer una consulta?",
        respuesta:
            "Escribinos a buenosaireswax@gmail.com o por WhatsApp al +54 11 3011-5436.",
    },
    {
        pregunta: "¿Cuáles son los medios de pago?",
        respuesta:
            "Aceptamos pagos con Mercado Pago a través de tarjeta de débito/crédito, transferencias bancarias y más.",
    },
    {
        pregunta: "¿Cómo funcionan los envíos?",
        respuesta:
            "Realizamos envíos a todo el país por Andreani. También podés retirar por Microcentro o Chacarita.",
    },
    {
        pregunta: "¿Cómo puedo comprar?",
        respuesta:
            "Agregás productos al carrito, completás tus datos y generás el pedido. Luego nos enviás el comprobante por WhatsApp.",
    },
    {
        pregunta: "¿Qué hago si realicé un pedido y no pude enviar el comprobante?",
        respuesta:
            "No te preocupes. Podés enviarnos el comprobante por WhatsApp al +54 11 3011-5436 para poder avanzar con el pedido.",
    },
    {
        pregunta: "¿Cuánto tarda en llegar mi pedido?",
        respuesta:
            "El envío puede demorar entre 3 a 7 días hábiles según la localidad. Te compartiremos el seguimiento.",
    },
];

function FaqModal({ onClose }) {
    const [modalRoot, setModalRoot] = useState(null);
    const [abierto, setAbierto] = useState(null);
    const [closing, setClosing] = useState(false);

    useEffect(() => {
        let root = document.getElementById("modal-root");
        if (!root) {
            root = document.createElement("div");
            root.id = "modal-root";
            document.body.appendChild(root);
        }
        setModalRoot(root);

        document.body.classList.add("modal-abierto");

        return () => {
            document.body.classList.remove("modal-abierto");
        };
    }, []);

    const toggle = (i) => {
        setAbierto(abierto === i ? null : i);
    };

    const handleClose = () => {
        setClosing(true);
        setTimeout(() => {
            onClose();
        }, 300); // coincide con la duración de la animación
    };

    if (!modalRoot) return null;

    return createPortal(
        <div
            className={`faq-backdrop ${closing ? "fade-out-backdrop" : "fade-in-backdrop"}`}
            onClick={(e) => {
                if (e.target.classList.contains("faq-backdrop")) handleClose();
            }}
        >
            <div className={`faq-modal ${closing ? "fade-out" : "fade-in"}`}>
                <button className="close-btn" onClick={handleClose}>
                    ×
                </button>
                <h2>Preguntas Frecuentes</h2>
                <div className="faq-list">
                    {preguntas.map((item, i) => (
                        <div key={i} className="faq-item">
                            <button
                                className={`faq-question ${abierto === i ? "abierta" : ""}`}
                                onClick={() => toggle(i)}
                            >
                                {item.pregunta}
                            </button>
                            <div
                                className={`faq-answer ${abierto === i ? "visible" : ""}`}
                                style={{
                                    maxHeight: abierto === i ? "300px" : "0",
                                    opacity: abierto === i ? 1 : 0,
                                }}
                            >
                                <p>{item.respuesta}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>,
        modalRoot
    );
}

export default FaqModal;
