export const DEFAULT_SITE_FEATURES = {
  drop: false,
  youtubeBanner: false,
  youtubePopup: false,
};

export const SITE_FEATURES_COLLECTION = "siteConfig";
export const SITE_FEATURES_DOC_ID = "features";

export const SITE_FEATURE_KEYS = Object.keys(DEFAULT_SITE_FEATURES);

export function normalizeSiteFeatures(value) {
  const source = value && typeof value === "object" ? value : {};

  return SITE_FEATURE_KEYS.reduce((acc, key) => {
    acc[key] =
      typeof source[key] === "boolean" ? source[key] : DEFAULT_SITE_FEATURES[key];
    return acc;
  }, {});
}
