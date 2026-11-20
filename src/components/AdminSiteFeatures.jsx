import { useEffect, useState } from "react";
import { useSiteFeatures } from "../context/SiteFeaturesContext";
import { DEFAULT_SITE_FEATURES } from "../utils/siteFeatures";

import "../styles/adminSiteFeatures.css";

const listToText = (arr) => (Array.isArray(arr) ? arr.join("\n") : "");
const textToList = (text) =>
  String(text || "")
    .split(/\r?\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);

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
  const [clubGenerosText, setClubGenerosText] = useState("");
  const [clubEstilosText, setClubEstilosText] = useState("");
  const [clubNivelesText, setClubNivelesText] = useState("");
  const [clubNotasPlaceholder, setClubNotasPlaceholder] = useState("");

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

  useEffect(() => {
    setLocalFeatures(features);
    const generosGuardados = features.clubGeneros || [];
    const generosViejos = generosGuardados.some((g) =>
      ["Chicago House", "Deep House", "Hardgroove"].includes(g)
    );
    setClubGenerosText(listToText(generosViejos ? DEFAULT_SITE_FEATURES.clubGeneros : generosGuardados));
    setClubEstilosText(listToText(features.clubEstilos));
    setClubNivelesText(listToText(features.clubNiveles));
    setClubNotasPlaceholder(features.clubNotasPlaceholder || "");
  }, [features]);

  const handleSaveClubStep4 = async () => {
    setSavingKey("clubStep4");
    setSavedKey(null);
    clearSaveError();
    const generos = textToList(clubGenerosText);
    const estilos = textToList(clubEstilosText);
    const niveles = textToList(clubNivelesText);
    const ok1 = await setFeature("clubGeneros", generos.length ? generos : features.clubGeneros);
    const ok2 = await setFeature("clubEstilos", estilos.length ? estilos : features.clubEstilos);
    const ok3 = await setFeature("clubNiveles", niveles.length ? niveles : features.clubNiveles);
    const ok4 = await setFeature("clubNotasPlaceholder", clubNotasPlaceholder.trim() || features.clubNotasPlaceholder);
    setSavingKey(null);
    if (ok1 && ok2 && ok3 && ok4) {
      setSavedKey("clubStep4");
      window.setTimeout(() => {
        setSavedKey((prev) => (prev === "clubStep4" ? null : prev));
      }, 2000);
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

      <div className="sf-section">
        <div className="sf-section-header">
          <h3 className="sf-section-title">
            <span className="sf-item-icon">♪</span>
            Vinyl Club - Step 4 (Gustos musicales)
          </h3>
          <p className="sf-section-desc">
            Configura las opciones que se muestran en el paso 4 del formulario de suscripcion al club.
            Los socios pueden elegir hasta 6 opciones en total entre generos y estilos.
          </p>
          <span
            className={`sf-item-status ${
              savingKey === "clubStep4"
                ? "sf-item-status--saving"
                : savedKey === "clubStep4"
                  ? "sf-item-status--saved"
                  : ""
            }`}
          >
            {savingKey === "clubStep4" ? "Guardando..." : savedKey === "clubStep4" ? "Guardado ✓" : ""}
          </span>
        </div>

        <div className="sf-extra">
          <div className="sf-extra-row">
            <label className="sf-label">
              Generos que te gustan (uno por linea)
              <textarea
                className="sf-input sf-textarea"
                rows={4}
                value={clubGenerosText}
                onChange={(e) => setClubGenerosText(e.target.value)}
              />
            </label>
          </div>
          <div className="sf-extra-row">
            <label className="sf-label">
              Estilos que te gustan (uno por linea)
              <textarea
                className="sf-input sf-textarea"
                rows={11}
                value={clubEstilosText}
                onChange={(e) => setClubEstilosText(e.target.value)}
              />
            </label>
          </div>
          <div className="sf-extra-row">
            <label className="sf-label">
              Tu coleccion (uno por linea)
              <textarea
                className="sf-input sf-textarea"
                rows={3}
                value={clubNivelesText}
                onChange={(e) => setClubNivelesText(e.target.value)}
              />
            </label>
          </div>
          <div className="sf-extra-row">
            <label className="sf-label">
              Placeholder del campo de notas
              <input
                className="sf-input"
                type="text"
                value={clubNotasPlaceholder}
                onChange={(e) => setClubNotasPlaceholder(e.target.value)}
              />
            </label>
          </div>
          <div className="sf-extra-actions">
            <button
              type="button"
              className="sf-save-btn"
              disabled={savingKey === "clubStep4"}
              onClick={handleSaveClubStep4}
            >
              {savingKey === "clubStep4" ? "Guardando..." : savedKey === "clubStep4" ? "Guardado" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
