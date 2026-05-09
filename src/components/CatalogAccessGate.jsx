import { useState } from "react";

const ACCESS_VERSION =
  import.meta.env.VITE_STORE_ACCESS_VERSION || import.meta.env.VITE_ACCESS_VERSION;
const STORE_ACCESS_CODE = import.meta.env.VITE_STORE_CODE || import.meta.env.VITE_DROP_CODE;

function hasSectionAccess(sectionKey) {
  const isAuth = sessionStorage.getItem(`catalogAccess:${sectionKey}`) === "true";
  const savedVersion = sessionStorage.getItem(`catalogAccessVersion:${sectionKey}`);
  return isAuth && savedVersion === ACCESS_VERSION;
}

function CatalogAccessGate({ sectionKey, sectionLabel, children }) {
  const [autenticado, setAutenticado] = useState(() => hasSectionAccess(sectionKey));
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const manejarSubmit = (e) => {
    e.preventDefault();

    if (password === STORE_ACCESS_CODE) {
      sessionStorage.setItem(`catalogAccess:${sectionKey}`, "true");
      sessionStorage.setItem(`catalogAccessVersion:${sectionKey}`, ACCESS_VERSION);
      setAutenticado(true);
      setError("");
      return;
    }

    setError("Contraseña incorrecta");
  };

  if (autenticado) return children;

  return (
    <section className="drop-access" style={{ paddingTop: "110px", paddingBottom: "48px" }}>
      <div className="drop-message">
        <p className="mensaje-drop-proximo">{sectionLabel} temporalmente cerrado</p>
      </div>

      <form onSubmit={manejarSubmit} className="formulario-acceso">
        <label>Ingresa la contraseña para acceder</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="xxxxx"
          autoComplete="new-password"
        />
        {error && <p className="error">{error}</p>}

        <button type="submit" className="btn-enviar-countdown">
          Acceder
        </button>
      </form>
    </section>
  );
}

export default CatalogAccessGate;