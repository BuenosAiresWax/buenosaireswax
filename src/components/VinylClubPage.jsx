import { useState, useRef, useEffect, useCallback } from "react";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { crearSuscripcion } from "../utils/mercadopago";
import "../styles/VinylClub.css";

const CATEGORIAS = [
  { id: "house", label: "House", icon: "🏠" },
  { id: "techno", label: "Techno", icon: "⚡" },
  { id: "deep", label: "Deep", icon: "🌊" },
];

const STEPS = [
  { id: 0, label: "Datos personales" },
  { id: 1, label: "Contacto" },
  { id: 2, label: "Envío" },
  { id: 3, label: "Géneros" },
];

function VinylClubPage() {
  const [step, setStep] = useState(0);
  const [nombre, setNombre] = useState("");
  const [nombreInstagram, setNombreInstagram] = useState("");
  const [dni, setDni] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [direccion, setDireccion] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [codigoPostal, setCodigoPostal] = useState("");
  const [preferencias, setPreferencias] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(false);
  const [yaSuscrito, setYaSuscrito] = useState(false);

  const [touched, setTouched] = useState({});
  const formRef = useRef(null);
  const stepRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem("vinylClubEmail");
    if (saved) {
      checkExistingSubscription(saved);
    }
  }, []);

  const checkExistingSubscription = async (email) => {
    try {
      const ref = doc(db, "clubvinilos", email);
      const snap = await getDoc(ref);
      if (snap.exists() && snap.data().activo) {
        setYaSuscrito(true);
        setExito(true);
      }
    } catch {
      // ignore
    }
  };

  const togglePreferencia = (id) => {
    setPreferencias((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
    setError(null);
  };

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const markTouched = useCallback((field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  const validate = useCallback(() => {
    switch (step) {
      case 0:
        if (!nombre.trim()) return "Ingresá tu nombre completo";
        if (!dni.trim()) return "Ingresá tu DNI";
        return null;
      case 1:
        if (!correo.trim()) return "Ingresá tu email";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return "El email no es válido";
        if (!telefono.trim()) return "Ingresá tu teléfono";
        return null;
      case 2:
        if (!direccion.trim()) return "Ingresá tu dirección";
        if (!ciudad.trim()) return "Ingresá tu ciudad";
        if (!codigoPostal.trim()) return "Ingresá tu código postal";
        return null;
      case 3:
        if (preferencias.length === 0) return "Elegí al menos un género";
        return null;
      default:
        return null;
    }
  }, [step, nombre, dni, correo, telefono, direccion, ciudad, codigoPostal, preferencias]);

  const nextStep = () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    stepRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const prevStep = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
    stepRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      setError(err);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const subscriberId = correo.trim().toLowerCase();
      const subscriberRef = doc(db, "clubvinilos", subscriberId);
      const existingSnap = await getDoc(subscriberRef);

      if (existingSnap.exists() && existingSnap.data().activo) {
        setYaSuscrito(true);
        setExito(true);
        setLoading(false);
        return;
      }

      const subscriberData = {
        nombre: nombre.trim(),
        instagram: nombreInstagram.trim(),
        dni: dni.trim(),
        telefono: telefono.trim(),
        correo: correo.trim().toLowerCase(),
        direccion: direccion.trim(),
        departamento: departamento.trim(),
        ciudad: ciudad.trim(),
        codigoPostal: codigoPostal.trim(),
        preferencias,
        activo: false,
        pendiente: true,
        fechaAlta: new Date().toISOString(),
        mercadopago_preapproval_id: null,
        mercadopago_status: null,
      };

      await setDoc(subscriberRef, subscriberData);

      try {
        const result = await crearSuscripcion({
          email: correo.trim().toLowerCase(),
          nombre: nombre.trim(),
        });

        if (result?.init_point) {
          localStorage.setItem("vinylClubEmail", subscriberId);
          window.location.href = result.init_point;
          return;
        }
      } catch (mpErr) {
        console.error("Error MercadoPago completo:", mpErr);
      }

      localStorage.setItem("vinylClubEmail", subscriberId);
      setExito(true);
    } catch (err) {
      console.error(err);
      setError("Hubo un error al procesar tu suscripción. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const formatPhone = (v) => v.replace(/\D/g, "");

  if (exito && yaSuscrito) {
    return (
      <div className="vc-container">
        <section className="vc-hero">
          <div className="vc-hero-overlay">
            <div className="vc-hero-content">
              <h1>Club de Vinilos</h1>
              <h2>Suscripción activa</h2>
            </div>
          </div>
        </section>
        <div className="vc-section">
          <div className="vc-success-card">
            <div className="vc-success-icon">🎶</div>
            <h2>Ya sos parte del Club de Vinilos</h2>
            <p>Tu suscripción está activa. Cada mes recibirás vinilos curados por BAWAX.</p>
          </div>
        </div>
      </div>
    );
  }

  if (exito) {
    return (
      <div className="vc-container">
        <section className="vc-hero">
          <div className="vc-hero-overlay">
            <div className="vc-hero-content">
              <h1>Club de Vinilos</h1>
              <h2>Suscripción</h2>
            </div>
          </div>
        </section>
        <div className="vc-section">
          <div className="vc-success-card">
            <div className="vc-success-icon">✓</div>
            <h2>¡Gracias por suscribirte!</h2>
            <p>
              Te enviaremos un email con los próximos pasos para activar tu suscripción mensual de
              vinilos curados por BAWAX.
            </p>
            <p className="vc-success-detail">
              Revisa tu casilla de correo (<strong>{correo}</strong>) para confirmar tu suscripción.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="vc-container">
      <section className="vc-hero">
        <div className="vc-hero-overlay">
          <div className="vc-hero-content">
            <h1>Club de Vinilos</h1>
            <h2>Suscribite al primer club de vinilos de musica electronica de Argentina</h2>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <div className="vc-section">
        <h2 className="vc-section-title">suscribete al club y recibe mensualmente</h2>

        <div className="vc-benefits">
          <div className="vc-benefit-card">
            <span className="vc-benefit-icon">🎶</span>
            <h3>Vinilo curado por nosotros</h3>
            <p>Seleccionamos los discos de deep house, house y techno especialmente para cada miembro del club.</p>
          </div>
          <div className="vc-benefit-card">
            <span className="vc-benefit-icon">🎁</span>
            <h3>Regalos especiales</h3>
            <p>Slipmats, kits de limpieza, accesorios personalizados y más.</p>
          </div>
          <div className="vc-benefit-card">
            <span className="vc-benefit-icon">💎</span>
            <h3>Accesos exclusivos</h3>
            <p>Acceso exclusivo a todos los eventos de BAWAX</p>
          </div>
        </div>

        <div className="vc-price-box">
          <span className="vc-price-amount">$70.000</span>
          <span className="vc-price-period">/ mes</span>
        </div>

        <button className="vc-cta-btn" onClick={scrollToForm}>
          Quiero suscribirme
        </button>
      </div>

      {/* Form multi-step */}
      <div className="vc-section vc-form-section" ref={formRef}>
        <h2 className="vc-section-title">Formulario de suscripción</h2>

        {/* Progress bar */}
        <div className="vc-progress" ref={stepRef}>
          <div className="vc-progress-bar">
            <div
              className="vc-progress-fill"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
          <div className="vc-progress-steps">
            {STEPS.map((s) => (
              <div
                key={s.id}
                className={`vc-progress-step ${step === s.id ? "active" : ""} ${step > s.id ? "done" : ""}`}
              >
                <div className="vc-step-dot">
                  {step > s.id ? "✓" : s.id + 1}
                </div>
                <span className="vc-step-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        <form className="vc-form" onSubmit={handleSubmit}>
          <div className="vc-form-card" key={step}>
            {/* Step 0: Datos personales */}
            {step === 0 && (
              <div className="vc-step-content">
                <div className="vc-step-header">
                  <span className="vc-step-icon">👤</span>
                  <div>
                    <h3>Datos personales</h3>
                    <p>Contanos sobre vos</p>
                  </div>
                </div>

                <div className="vc-field-group">
                  <input
                    className={`vc-field ${touched.nombre && !nombre.trim() ? "error" : ""}`}
                    type="text"
                    placeholder="Nombre completo *"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    onBlur={() => markTouched("nombre")}
                    required
                    disabled={loading}
                  />
                  {touched.nombre && !nombre.trim() && (
                    <span className="vc-field-error">Requerido</span>
                  )}
                </div>

                <div className="vc-field-group">
                  <input
                    className="vc-field"
                    type="text"
                    placeholder="Instagram @"
                    value={nombreInstagram}
                    onChange={(e) => setNombreInstagram(e.target.value)}
                    disabled={loading}
                  />
                  <span className="vc-field-hint">Opcional</span>
                </div>

                <div className="vc-field-group">
                  <input
                    className={`vc-field ${touched.dni && !dni.trim() ? "error" : ""}`}
                    type="number"
                    placeholder="DNI *"
                    value={dni}
                    onChange={(e) => setDni(e.target.value)}
                    onBlur={() => markTouched("dni")}
                    required
                    disabled={loading}
                  />
                  {touched.dni && !dni.trim() && (
                    <span className="vc-field-error">Requerido</span>
                  )}
                </div>
              </div>
            )}

            {/* Step 1: Contacto */}
            {step === 1 && (
              <div className="vc-step-content">
                <div className="vc-step-header">
                  <span className="vc-step-icon">📧</span>
                  <div>
                    <h3>Contacto</h3>
                    <p>Para enviarte las novedades</p>
                  </div>
                </div>

                <div className="vc-field-group">
                  <input
                    className={`vc-field ${touched.correo && (!correo.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) ? "error" : ""}`}
                    type="email"
                    placeholder="Email *"
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                    onBlur={() => markTouched("correo")}
                    required
                    disabled={loading}
                  />
                  {touched.correo && !correo.trim() && (
                    <span className="vc-field-error">Requerido</span>
                  )}
                  {touched.correo && correo.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) && (
                    <span className="vc-field-error">Email inválido</span>
                  )}
                </div>

                <div className="vc-field-group">
                  <input
                    className={`vc-field ${touched.telefono && !telefono.trim() ? "error" : ""}`}
                    type="tel"
                    placeholder="Teléfono (sin espacios) *"
                    value={telefono}
                    onChange={(e) => setTelefono(formatPhone(e.target.value))}
                    onBlur={() => markTouched("telefono")}
                    required
                    disabled={loading}
                  />
                  {touched.telefono && !telefono.trim() && (
                    <span className="vc-field-error">Requerido</span>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Envío */}
            {step === 2 && (
              <div className="vc-step-content">
                <div className="vc-step-header">
                  <span className="vc-step-icon">📦</span>
                  <div>
                    <h3>Dirección de envío</h3>
                    <p>Para enviarte tu vinyl club box</p>
                  </div>
                </div>

                <div className="vc-field-group">
                  <input
                    className={`vc-field ${touched.direccion && !direccion.trim() ? "error" : ""}`}
                    type="text"
                    placeholder="Calle y número *"
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    onBlur={() => markTouched("direccion")}
                    required
                    disabled={loading}
                  />
                  {touched.direccion && !direccion.trim() && (
                    <span className="vc-field-error">Requerido</span>
                  )}
                </div>

                <div className="vc-field-group">
                  <input
                    className="vc-field"
                    type="text"
                    placeholder="Piso y Departamento (opcional)"
                    value={departamento}
                    onChange={(e) => setDepartamento(e.target.value)}
                    disabled={loading}
                  />
                  <span className="vc-field-hint">Opcional</span>
                </div>

                <div className="vc-field-row">
                  <div className="vc-field-group vc-field-half">
                    <input
                      className={`vc-field ${touched.ciudad && !ciudad.trim() ? "error" : ""}`}
                      type="text"
                      placeholder="Ciudad *"
                      value={ciudad}
                      onChange={(e) => setCiudad(e.target.value)}
                      onBlur={() => markTouched("ciudad")}
                      required
                      disabled={loading}
                    />
                    {touched.ciudad && !ciudad.trim() && (
                      <span className="vc-field-error">Requerido</span>
                    )}
                  </div>
                  <div className="vc-field-group vc-field-half">
                    <input
                      className={`vc-field ${touched.codigoPostal && !codigoPostal.trim() ? "error" : ""}`}
                      type="text"
                      placeholder="Código Postal *"
                      value={codigoPostal}
                      onChange={(e) => setCodigoPostal(e.target.value)}
                      onBlur={() => markTouched("codigoPostal")}
                      required
                      disabled={loading}
                    />
                    {touched.codigoPostal && !codigoPostal.trim() && (
                      <span className="vc-field-error">Requerido</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Preferencias */}
            {step === 3 && (
              <div className="vc-step-content">
                <div className="vc-step-header">
                  <span className="vc-step-icon">🎵</span>
                  <div>
                    <h3>Géneros musicales</h3>
                    <p>¿Qué te gusta escuchar?</p>
                  </div>
                </div>

                <p className="vc-preferencias-subtitle">
                  Elegí uno o más géneros. Los usaremos para personalizar tu caja mensual.
                </p>

                <div className="vc-preferencias-grid">
                  {CATEGORIAS.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      className={`vc-preferencia-card ${preferencias.includes(cat.id) ? "selected" : ""}`}
                      onClick={() => togglePreferencia(cat.id)}
                      disabled={loading}
                    >
                      <span className="vc-pref-card-icon">{cat.icon}</span>
                      <span className="vc-pref-card-label">{cat.label}</span>
                      {preferencias.includes(cat.id) && (
                        <span className="vc-pref-card-check">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="vc-error-banner">
              <span className="vc-error-icon">!</span>
              {error}
            </div>
          )}

          <div className="vc-form-actions">
            {step > 0 && (
              <button
                type="button"
                className="vc-btn-secondary"
                onClick={prevStep}
                disabled={loading}
              >
                ← Atrás
              </button>
            )}

            {step < STEPS.length - 1 ? (
              <button
                type="button"
                className="vc-btn-primary"
                onClick={nextStep}
                disabled={loading}
              >
                Siguiente →
              </button>
            ) : (
              <button
                className="vc-btn-primary vc-btn-submit"
                type="submit"
                disabled={loading || preferencias.length === 0}
              >
                {loading ? (
                  <span className="vc-btn-loading">
                    <span className="vc-spinner" />
                    Procesando...
                  </span>
                ) : (
                  "Suscribirme - $70.000/mes"
                )}
              </button>
            )}
          </div>

          <p className="vc-form-note">
            Al suscribirte, aceptás los términos del servicio. Podés cancelar en cualquier momento.
          </p>
        </form>
      </div>
    </div>
  );
}

export default VinylClubPage;
