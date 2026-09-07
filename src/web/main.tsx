import "./color-scheme";
import "@mantine/core/styles.css";
import "@mantine/dropzone/styles.css";
import "@mantine/notifications/styles.css";
import "./styles.css";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { applyDocument, cachedConfig } from "./config";

applyDocument(cachedConfig());

createRoot(document.getElementById("root")!).render(<App />);
