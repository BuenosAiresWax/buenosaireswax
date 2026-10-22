import { useEffect, useState } from "react";
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
    extra: true,
  },
  {
    key: "youtubePopup",
    icon: "▶️",
    title: "Popup de YouTube",
    description:
      "Muestra el video emergente de YouTube sobre el listado de productos (tienda y drop).",
    extra: true,
  },
];

export default function AdminSiteFeatures() {
  const { features, initialized, saveError, clearSaveError, setFeature } =
    useSiteFeatures();
  const [localFeatures, setLocalFeatures] = useState(features);
  const [savingKey, setSavingKey] = useState(null);
  const [savedKey, setSavedKey] = useState(null);

  const setFeatures = setLocalFeatures;

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
      }, 2000);
    }
  };

  const handleChange = async (key, value) => {
    setSavingKey(key);
    setSavedKey(null);
    clearSaveError();
    const ok = await setFeature(key, value);
    setSavingKey(null);
    if (ok) {
      setSavedKey(key);
      window.setTimeout(() => {
        setSavedKey((prev) => (prev === key ? null : prev));
      }, 2000);
    }
  };

  const handleSaveExtra = async (key) => {
    setSavingKey(key);
    setSavedKey(null);
    clearSaveError();
    const ok = await setFeature(key, features[key]);
    setSavingKey(null);
    if (ok) {
      setSavedKey(key);
      window.setTimeout(() => {
        setSavedKey((prev) => (prev === key ? null : prev));
      }, 2000);
    }
  };

  useEffect(() => {
    setLocalFeatures(features);
  }, [features]);

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
  const data = localFeatures || features;
  const activo = Boolean(data[feature.key]);
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

                {feature.extra && (
                  <div className="sf-extra">
                    {feature.key === "youtubeBanner" && (
                      <>
                        <div className="sf-extra-row">
                          <label className="sf-label">
                            Título del banner
                            <input
                              className="sf-input"
                              type="text"
                              value={data.youtubeBannerTitle || ""}
                          onChange={(e) => {
                            setLocalFeatures((prev) => ({ ...(prev || features), youtubeBannerTitle: e.target.value }));
                          }}
                          onBlur={(e) => {
                            setFeature("youtubeBannerTitle", e.target.value || "");
                          }}
                            />
                          </label>
                        </div>
                        <div className="sf-extra-row">
                          <label className="sf-label">
                            ID del video de YouTube
                            <input
                              className="sf-input"
                              type="text"
                              value={data.youtubeBannerVideoId || ""}
                              onChange={(e) => {
                                setLocalFeatures((prev) => ({ ...(prev || features), youtubeBannerVideoId: e.target.value }));
                              }}
                              onBlur={(e) => {
                                setFeature("youtubeBannerVideoId", e.target.value || "");
                              }}
                              placeholder="Ej: WYleJOwfIVg"
                            />
                          </label>
                        </div>
                        <div className="sf-extra-row">
                          <label className="sf-label">
                            Imagen del banner (URL o subir)
                            <input
                              className="sf-input"
                              type="text"
                              value={data.youtubeBannerImage || ""}
                              onChange={(e) => {
                                setLocalFeatures((prev) => ({ ...(prev || features), youtubeBannerImage: e.target.value }));
                              }}
                              onBlur={(e) => {
                                setFeature("youtubeBannerImage", e.target.value || "");
                              }}
                              placeholder="https://... o dejar vacío para usar miniatura de YouTube"
                            />
                          </label>
                        </div>
                        <div className="sf-extra-actions">
                          <button
                            type="button"
                            className="sf-save-btn"
                            disabled={savingKey === "youtubeBanner"}
                            onClick={async () => {
                              setSavingKey("youtubeBanner");
                              setSavedKey(null);
                              clearSaveError();
                              const ok1 = await setFeature("youtubeBannerTitle", data.youtubeBannerTitle || "");
                              const ok2 = await setFeature("youtubeBannerVideoId", data.youtubeBannerVideoId || "");
                              const ok3 = await setFeature("youtubeBannerImage", data.youtubeBannerImage || "");
                              setSavingKey(null);
                              if (ok1 && ok2 && ok3) {
                                setSavedKey("youtubeBanner");
                                window.setTimeout(() => {
                                  setSavedKey((prev) => (prev === "youtubeBanner" ? null : prev));
                                }, 2000);
                              }
                            }}
                          >
                            {savingKey === "youtubeBanner" ? "Guardando..." : savedKey === "youtubeBanner" ? "Guardado" : "Guardar"}
                          </button>
                        </div>
                      </>
                    )}
                    {feature.key === "youtubePopup" && (
                      <>
                        <div className="sf-extra-row">
                          <label className="sf-label">
                            Título del popup
                            <input
                              className="sf-input"
                              type="text"
                              value={data.youtubePopupTitle || ""}
                          onChange={(e) => {
                            setLocalFeatures((prev) => ({ ...(prev || features), youtubePopupTitle: e.target.value }));
                          }}
                          onBlur={(e) => {
                            setFeature("youtubePopupTitle", e.target.value || "");
                          }}
                            />
                          </label>
                        </div>
                        <div className="sf-extra-row">
                          <label className="sf-label">
                            ID del video de YouTube
                            <input
                              className="sf-input"
                              type="text"
                              value={data.youtubePopupVideoId || ""}
                          onChange={(e) => {
                            setLocalFeatures((prev) => ({ ...(prev || features), youtubePopupVideoId: e.target.value }));
                          }}
                          onBlur={(e) => {
                            setFeature("youtubePopupVideoId", e.target.value || "");
                          }}
                          placeholder="Ej: WYleJOwfIVg"
                            />
                          </label>
                        </div>
                        <div className="sf-extra-actions">
                          <button
                            type="button"
                            className="sf-save-btn"
                            disabled={savingKey === "youtubePopup"}
                            onClick={async () => {
                              setSavingKey("youtubePopup");
                              setSavedKey(null);
                              clearSaveError();
                              const ok1 = await setFeature("youtubePopupTitle", data.youtubePopupTitle || "");
                              const ok2 = await setFeature("youtubePopupVideoId", data.youtubePopupVideoId || "");
                              setSavingKey(null);
                              if (ok1 && ok2) {
                                setSavedKey("youtubePopup");
                                window.setTimeout(() => {
                                  setSavedKey((prev) => (prev === "youtubePopup" ? null : prev));
                                }, 2000);
                              }
                            }}
                          >
                            {savingKey === "youtubePopup" ? "Guardando..." : savedKey === "youtubePopup" ? "Guardado" : "Guardar"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
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
