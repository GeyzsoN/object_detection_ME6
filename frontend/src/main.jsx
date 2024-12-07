import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { ThemeProvider } from "@/components/theme-provider";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
    {/* <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme"> */}
      <App />
    </ThemeProvider>
  </StrictMode>
);