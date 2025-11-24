// src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage.jsx";
import TemplatesPage from "./pages/TemplatesPage.jsx";
import TemplateEditorPage from "./pages/TemplateEditorPage.jsx";
import TemplateDetailPage from "./pages/TemplateDetailPage.jsx";
import BatchDetailPage from "./pages/BatchDetailPage.jsx";
import VerifyCertificatePage from "./pages/VerifyCertificatePage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<TemplatesPage />} />
      <Route path="/template/:id/edit" element={<TemplateEditorPage />} />
      <Route path="/templatedetail/:id" element={<TemplateDetailPage />} />
      <Route path="/batch/:id" element={<BatchDetailPage />} />
      <Route path="/verify/:certId" element={<VerifyCertificatePage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
