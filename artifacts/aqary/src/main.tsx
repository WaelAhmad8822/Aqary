import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

// In local dev the frontend runs on :5173 while API runs on :5001 (see api-server .env PORT).
if (import.meta.env.DEV) {
  setBaseUrl(import.meta.env.VITE_API_BASE_URL || "http://localhost:5001");
}

createRoot(document.getElementById("root")!).render(<App />);
