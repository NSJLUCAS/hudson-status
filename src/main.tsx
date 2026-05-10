/** 应用入口：路由、React Query、主题。 */
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import App from "./App.tsx";
import NodehubPage from "./pages/NodehubPage.tsx";
import BillingPage from "./pages/BillingPage.tsx";
import "./index.css";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/nodehub" element={<NodehubPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/map" element={<Navigate to="/nodehub" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </QueryClientProvider>
);
