import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import {
  DEFAULT_SITE_FEATURES,
  SITE_FEATURES_COLLECTION,
  SITE_FEATURES_DOC_ID,
  normalizeSiteFeatures,
} from "../utils/siteFeatures";

const SiteFeaturesContext = createContext({
  features: DEFAULT_SITE_FEATURES,
  initialized: false,
  saveError: null,
  clearSaveError: () => {},
  setFeature: async () => false,
});

export function SiteFeaturesProvider({ children }) {
  const [features, setFeatures] = useState(DEFAULT_SITE_FEATURES);
  const [initialized, setInitialized] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    const referencia = doc(db, SITE_FEATURES_COLLECTION, SITE_FEATURES_DOC_ID);

    const unsubscribe = onSnapshot(
      referencia,
      (snapshot) => {
        setFeatures(
          normalizeSiteFeatures(snapshot.exists() ? snapshot.data() : {}),
        );
        setInitialized(true);
      },
      () => {
        setFeatures(DEFAULT_SITE_FEATURES);
        setInitialized(true);
      },
    );

    return unsubscribe;
  }, []);

  const clearSaveError = useCallback(() => setSaveError(null), []);

  const setFeature = useCallback(async (key, value) => {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_SITE_FEATURES, key)) {
      return false;
    }

    setSaveError(null);

    try {
      await setDoc(
        doc(db, SITE_FEATURES_COLLECTION, SITE_FEATURES_DOC_ID),
        { [key]: Boolean(value) },
        { merge: true },
      );
      return true;
    } catch {
      setSaveError("No se pudo guardar. Revisá la conexión y las reglas de Firestore.");
      return false;
    }
  }, []);

  const value = {
    features,
    initialized,
    saveError,
    clearSaveError,
    setFeature,
  };

  return (
    <SiteFeaturesContext.Provider value={value}>
      {children}
    </SiteFeaturesContext.Provider>
  );
}

export function useSiteFeatures() {
  return useContext(SiteFeaturesContext);
}
