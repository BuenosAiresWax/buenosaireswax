export const DEFAULT_SITE_FEATURES = {
  drop: false,
  youtubeBanner: false,
  youtubePopup: false,
  youtubeBannerTitle: "Drop 016 - Disponible en YouTube",
  youtubeBannerVideoId: "WYleJOwfIVg",
  youtubeBannerImage: "",
  youtubePopupTitle: "Ultimo drop - Miralo ya!!!",
  youtubePopupVideoId: "WYleJOwfIVg",
  clubGeneros: [
    "Chicago House",
    "Deep",
    "Deep House",
    "Detroit",
    "Funky",
    "Hardgroove",
    "House",
    "Jazzy",
    "Rave",
    "Techno",
  ],
  clubNiveles: ["Estoy empezando", "Coleccion intermedia", "Coleccion avanzada"],
  clubFormatos: ["Sorprendeme", "Mas bailables", "Mas calmos"],
  clubNotasPlaceholder: "Sellos, artistas o estilos que te gusten o prefieras evitar",
};

export const SITE_FEATURES_COLLECTION = "siteConfig";
export const SITE_FEATURES_DOC_ID = "features";

export const SITE_FEATURE_KEYS = Object.keys(DEFAULT_SITE_FEATURES);

export function normalizeSiteFeatures(value) {
  const source = value && typeof value === "object" ? value : {};

  return SITE_FEATURE_KEYS.reduce((acc, key) => {
    const defaultVal = DEFAULT_SITE_FEATURES[key];
    if (typeof defaultVal === "boolean") {
      acc[key] = typeof source[key] === "boolean" ? source[key] : defaultVal;
      return acc;
    }
    if (Array.isArray(defaultVal)) {
      if (Array.isArray(source[key])) {
        const arr = source[key]
          .map((v) => (typeof v === "string" ? v.trim() : ""))
          .filter(Boolean);
        acc[key] = arr.length > 0 ? arr : [...defaultVal];
      } else {
        acc[key] = [...defaultVal];
      }
      return acc;
    }
    acc[key] =
      typeof source[key] === "string" && source[key].trim() !== ""
        ? source[key]
        : defaultVal;
    return acc;
  }, {});
}
