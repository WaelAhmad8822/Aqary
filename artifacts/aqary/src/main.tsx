import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

// In local dev the frontend runs on :5173 while API runs on :5001 (see api-server .env PORT).
if (import.meta.env.DEV) {
  setBaseUrl("https://workspaceapi-server-production-6b84.up.railway.app");
}

createRoot(document.getElementById("root")!).render(<App />);
