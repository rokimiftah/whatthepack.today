// src/index.tsx

import React from "react";
import ReactDOM from "react-dom/client";

import "@mantine/core/styles.css";

import App from "@app/App";

import "@shared/styles/index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
