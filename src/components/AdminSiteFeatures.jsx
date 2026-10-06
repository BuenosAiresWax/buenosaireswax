import { useState } from "react";
import { useSiteFeatures } from "../context/SiteFeaturesContext";

import "../styles/adminSiteFeatures.css";

const FEATURES = [
  {
    key: "drop",
    icon: "🎵",
    title: "Próximo Drop",
    description:
      "Muestra el ícono en el menú, la ruta /drop y la sección de cuenta regresiva en el home. Al apagarlo, el home muestra siempre la Tienda de Vinilos.",
  },
  {
    key: "youtubeBanner",
    icon: "🖼️",
    title: "Banner de YouTube",
    description:
      "Muestra el segundo slide de YouTube dentro del slider principal (home y tienda).",
  },
  {
    key: "youtubePopup",
    icon: "▶️",
    title: "Popup de YouTube",
    description:
      "Muestra el video emergente de YouTube sobre el listado de productos (tienda y drop).",
  },
];

export default function AdminSiteFeatures() {
  const { features, initialized, saveError, clearSaveError, setFeature } =
    useSiteFeatures();
  const [savingKey, setSavingKey] = useState(null);
  const [savedKey, setSavedKey] = useState(null);

  const handleToggle = async (key, value) => {
    setSavingKey(key);
    setSavedKey(null);
    clearSaveError();

    const ok = await setFeature(key, value);

    setSavingKey(null);

    if (ok) {
      setSavedKey(key);
      window.setTimeout(() => {
        setSavedKey((prev) => (prev === key ? null : prev));
      }, 2500);
    }
  };

  if (!initialized) {
    return (
      <div className="sf-container">
        <p className="sf-loading">Cargando configuración del sitio…</p>
      </div>
    );
  }

  return (
    <div className="sf-container">
      <div className="sf-header">
        <h2 className="sf-title">Ajustes del sitio</h2>
        <p className="sf-subtitle">
          Los cambios se aplican en todo el sitio al instante, sin necesidad de
          publicar.
        </p>
      </div>

      {saveError && <div className="sf-error">{saveError}</div>}

      <div className="sf-list">
        {FEATURES.map((feature) => {
          const activo = Boolean(features[feature.key]);
          const guardando = savingKey === feature.key;
          const guardado = savedKey === feature.key;

          return (
            <div className="sf-item" key={feature.key}>
              <div className="sf-item-info">
                <span className="sf-item-title">
                  <span className="sf-item-icon">{feature.icon}</span>
                  {feature.title}
                </span>
                <span className="sf-item-desc">{feature.description}</span>
                <span
                  className={`sf-item-status ${
                    guardando
                      ? "sf-item-status--saving"
                      : guardado
                        ? "sf-item-status--saved"
                        : activo
                          ? "sf-item-status--on"
                          : "sf-item-status--off"
                  }`}
                >
                  {guardando
                    ? "Guardando…"
                    : guardado
                      ? "Guardado ✓"
                      : activo
                        ? "Visible"
                        : "Oculto"}
                </span>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={activo}
                aria-label={`Activar ${feature.title}`}
                className={`sf-switch ${activo ? "sf-switch--on" : ""}`}
                disabled={guardando}
                onClick={() => handleToggle(feature.key, !activo)}
              >
                <span className="sf-knob" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
