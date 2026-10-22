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
      async (snapshot) => {
        const rawData = snapshot.exists() ? snapshot.data() : {};
        const normalized = normalizeSiteFeatures(rawData);
        setFeatures(normalized);
        setInitialized(true);

        const missing = {};
        if (typeof rawData.youtubeBannerTitle !== "string" || !rawData.youtubeBannerTitle.trim()) {
          missing.youtubeBannerTitle = DEFAULT_SITE_FEATURES.youtubeBannerTitle;
        }
        if (typeof rawData.youtubeBannerVideoId !== "string" || !rawData.youtubeBannerVideoId.trim()) {
          missing.youtubeBannerVideoId = DEFAULT_SITE_FEATURES.youtubeBannerVideoId;
        }
        if (typeof rawData.youtubePopupTitle !== "string" || !rawData.youtubePopupTitle.trim()) {
          missing.youtubePopupTitle = DEFAULT_SITE_FEATURES.youtubePopupTitle;
        }
        if (typeof rawData.youtubePopupVideoId !== "string" || !rawData.youtubePopupVideoId.trim()) {
          missing.youtubePopupVideoId = DEFAULT_SITE_FEATURES.youtubePopupVideoId;
        }
        if (typeof rawData.youtubeBanner !== "boolean") {
          missing.youtubeBanner = DEFAULT_SITE_FEATURES.youtubeBanner;
        }
        if (typeof rawData.youtubePopup !== "boolean") {
          missing.youtubePopup = DEFAULT_SITE_FEATURES.youtubePopup;
        }

        if (Object.keys(missing).length > 0) {
          try {
            await setDoc(referencia, missing, { merge: true });
          } catch {
            // ignore
          }
        }
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
      const payload = typeof DEFAULT_SITE_FEATURES[key] === "boolean" ? { [key]: Boolean(value) } : { [key]: value };
      await setDoc(
        doc(db, SITE_FEATURES_COLLECTION, SITE_FEATURES_DOC_ID),
        payload,
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
