import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import "./index.css";
import App from "./App";
import { store } from "./app/store";
import { queryClient } from "./app/queryClient";
import { ThemeProvider } from "./app/theme";
import { ErrorBoundary } from "./shared/components/ErrorBoundary";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <Provider store={store}>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <App />
              {/*
                Bottom-centre, not top-right. On a phone the top-right corner is
                the furthest point from a thumb and sits under the notch on some
                devices; a toast that has to be dismissed belongs where the hand
                already is. `richColors` keeps success and error distinguishable
                without relying on the icon alone.
              */}
              <Toaster richColors closeButton position="bottom-center" offset={16} />
            </BrowserRouter>
          </QueryClientProvider>
        </Provider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
