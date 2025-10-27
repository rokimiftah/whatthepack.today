// src/app/App.tsx

import { Router } from "wouter";

import { ToastContainer, useToast } from "@shared/components/Toast";

import { AppProviders } from "./providers/AppProviders";
import { AppRoutes } from "./router";

function AppContent() {
  const { toasts, closeToast } = useToast();

  return (
    <>
      <Router base="/">
        <AppRoutes />
      </Router>
      <ToastContainer toasts={toasts} onClose={closeToast} />
    </>
  );
}

export default function App() {
  return (
    <AppProviders>
      <AppContent />
    </AppProviders>
  );
}
