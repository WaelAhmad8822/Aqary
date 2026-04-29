import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

const defaultApiBaseUrl = "https://workspaceapi-server-production-6b84.up.railway.app";
setBaseUrl(import.meta.env.VITE_API_BASE_URL || defaultApiBaseUrl);

createRoot(document.getElementById("root")!).render(<App />);
