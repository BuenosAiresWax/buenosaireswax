import { Navigate } from "react-router-dom";
import { useSiteFeatures } from "../context/SiteFeaturesContext";

function DropGate({ children }) {
  const { features, initialized } = useSiteFeatures();

  if (!initialized) return null;

  if (!features.drop) return <Navigate to="/" replace />;

  return children;
}

export default DropGate;
