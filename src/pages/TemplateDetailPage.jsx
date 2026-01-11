// src/pages/TemplateDetailPage.jsx
import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import client from "../api/client";
import toast from "react-hot-toast";
import { API_BASE_URL } from "../config";

function resolveImageUrl(path) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE_URL}${path}`;
}

/**
 * Scale font size based on displayed image dimensions
 * Maintains consistent font sizing regardless of zoom level
 */
function getEffectiveFontSize(baseFontSize, naturalHeight, displayHeight) {
  if (!naturalHeight || !displayHeight) return baseFontSize;
  const REFERENCE_HEIGHT = 800;
  const scale = displayHeight / REFERENCE_HEIGHT;
  return Math.round(baseFontSize * scale);
}

export default function TemplateDetailPage() {
  // NOTE: /templatedetail/:id where :id is templateCode
  const { id } = useParams();
  const navigate = useNavigate();

  const [template, setTemplate] = useState(null);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingBatches, setLoadingBatches] = useState(false);

  // Image dimensions for font scaling
  const imageRef = useRef(null);
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });
  const [naturalImgSize, setNaturalImgSize] = useState({ width: 0, height: 0 });

  // Generate Batch modal state
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [batchName, setBatchName] = useState("");
  const [csvFile, setCsvFile] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  // Load template
  useEffect(() => {
    async function fetchTemplate() {
      try {
        setLoading(true);
        // Backend: /templates/:id where :id is templateCode
        const res = await client.get(`/templates/${id}`);
        setTemplate(res.data);
      } catch (err) {
        if (err.response?.status === 401) {
          navigate("/login", { replace: true });
        } else {
          toast.error(err.response?.data?.message || "Failed to load template");
        }
      } finally {
        setLoading(false);
      }
    }

    fetchTemplate();
  }, [id, navigate]);

  // Load batches
  async function fetchBatches() {
    try {
      setLoadingBatches(true);
      // Backend: /templates/:id/batches where :id is templateCode
      const res = await client.get(`/templates/${id}/batches`);
      setBatches(res.data || []);
    } catch (err) {
      if (err.response?.status === 401) {
        navigate("/login", { replace: true });
      } else {
        toast.error(err.response?.data?.message || "Failed to load batches");
      }
    } finally {
      setLoadingBatches(false);
    }
  }

  useEffect(() => {
    fetchBatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Handle window resize to update displayed image size
  useEffect(() => {
    function handleResize() {
      if (imageRef.current) {
        setImgSize({
          width: imageRef.current.offsetWidth,
          height: imageRef.current.offsetHeight,
        });
      }
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Download helper (sample CSV, template file)
  async function downloadFile(url, filenameFallback) {
    try {
      const res = await client.get(url, { responseType: "blob" });
      const blob = new Blob([res.data]);
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;

      const cd = res.headers["content-disposition"];
      let filename = filenameFallback;
      if (cd && cd.includes("filename=")) {
        const match = cd.match(/filename="?(.+)"?/);
        if (match?.[1]) filename = match[1];
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(href);
    } catch (err) {
      if (err.response?.status === 401) {
        navigate("/login", { replace: true });
      } else {
        toast.error(err.response?.data?.message || "Download failed");
      }
    }
  }

  function handleDownloadSampleCsv() {
    if (!template) return;
    downloadFile(
      `/templates/${id}/sample-csv`,
      `${template.name.replace(/\s+/g, "_")}_sample.csv`
    );
  }

  async function handleDownloadTemplateFile() {
    if (!template) return;
    
    try {
      const downloadUrl = resolveImageUrl(template.imagePath);
      
      // Download the file directly
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `${template.name.replace(/\s+/g, "_")}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(href);
      
      toast.success("Template downloaded");
    } catch (err) {
      console.error(err);
      toast.error("Failed to download template");
    }
  }

  // Generate Batch Modal handlers

  function openGenerateModal() {
    setBatchName("");
    setCsvFile(null);
    setProgress(0);
    setShowGenerateModal(true);
  }

  function closeGenerateModal() {
    if (isGenerating) return;
    setShowGenerateModal(false);
  }

  function handleCsvChange(e) {
    const file = e.target.files?.[0];
    if (!file) {
      setCsvFile(null);
      return;
    }

    const isCsv =
      file.type === "text/csv" || file.name.toLowerCase().endsWith(".csv");

    if (!isCsv) {
      toast.error("Please upload a CSV file");
      setCsvFile(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("CSV file size must be less than 5 MB");
      setCsvFile(null);
      return;
    }

    setCsvFile(file);
  }

  async function handleGenerateBatch(e) {
    e.preventDefault();
    if (!batchName.trim()) {
      toast.error("Batch name is required");
      return;
    }
    if (!csvFile) {
      toast.error("CSV file is required");
      return;
    }

    setIsGenerating(true);
    setProgress(10);

    let current = 10;
    const interval = setInterval(() => {
      current = Math.min(current + 5, 90);
      setProgress(current);
    }, 300);

    try {
      const formData = new FormData();
      formData.append("batchName", batchName.trim());
      formData.append("csv", csvFile);

      // Backend: /templates/:id/batches where :id is templateCode
      await client.post(`/templates/${id}/batches`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setProgress(100);
      toast.success("Batch certificates generated");

      clearInterval(interval);
      setIsGenerating(false);

      fetchBatches();
    } catch (err) {
      clearInterval(interval);
      setIsGenerating(false);
      setProgress(0);
      if (err.response?.status === 401) {
        navigate("/login", { replace: true });
      } else {
        toast.error(
          err.response?.data?.message || "Failed to generate certificates"
        );
      }
    }
  }

  function goToBatch(batchCode) {
    // Route: /batch/:id where :id is batchCode
    navigate(`/batch/${batchCode}`);
  }

  function formatDate(dateStr) {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleString();
  }

  if (loading) {
    return (
      <div className="template-detail-page">
        <p style={{ padding: 24, textAlign: "center" }}>Loading template...</p>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="template-detail-page">
        <p style={{ padding: 24, textAlign: "center" }}>Template not found</p>
      </div>
    );
  }

  const qr =
    template.qrConfig && template.qrConfig.enabled ? template.qrConfig : null;

  const certIdCfg =
    template.certificateIdConfig && template.certificateIdConfig.enabled
      ? template.certificateIdConfig
      : null;

  return (
    <div className="template-detail-page">
      {/* Reuse header */}
      <header className="templates-header">
        <div className="logo">masai.</div>
        <h1>Templates</h1>
        <div className="user-avatar">H</div>
      </header>

      <main className="template-detail-main">
        {/* LEFT: Template preview & actions */}
        <section className="template-detail-left template-detail-card">
          <div className="template-detail-header">
            <div>
              <h2 className="template-detail-title">{template.name}</h2>
              <p className="template-detail-subtitle">
                This is the base template used for generating certificates.
              </p>
            </div>
            <button
              type="button"
              className="btn-pill btn-light"
              onClick={() => navigate("/")}
            >
              Back
            </button>
          </div>

          <div className="template-detail-preview-wrapper">
            <div className="template-detail-preview-inner">
              <img
                ref={imageRef}
                src={resolveImageUrl(template.imagePath)}
                alt={template.name}
                className="template-detail-image"
                onLoad={(e) => {
                  setNaturalImgSize({
                    width: e.target.naturalWidth,
                    height: e.target.naturalHeight,
                  });
                  setImgSize({
                    width: e.target.offsetWidth,
                    height: e.target.offsetHeight,
                  });
                }}
              />

              {/* Overlay non-editable fields */}
              {(template.fields || []).map((field) => {
                const left = `${(field.x ?? 0) * 100}%`;
                const top = `${(field.y ?? 0) * 100}%`;
                const width = field.width ? `${field.width * 100}%` : "auto";
                const height = field.height ? `${field.height * 100}%` : "auto";

                const align = field.textAlign || "left";

                return (
                  <div
                    key={field._id || field.key}
                    className="template-detail-field-overlay"
                    style={{
                      left,
                      top,
                      width,
                      height,
                      fontSize: `${getEffectiveFontSize(field.fontSize || 24, naturalImgSize.height, imgSize.height)}px`,
                      color: field.fontColor || "#000000",
                      fontWeight: field.fontWeight || 400,
                      fontFamily:
                        field.fontFamily || "Arial, system-ui, sans-serif",
                      textAlign: align,
                      justifyContent:
                        align === "center"
                          ? "center"
                          : align === "right"
                          ? "flex-end"
                          : "flex-start",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {field.sampleText || field.label}
                  </div>
                );
              })}

              {/* QR preview overlay (non-editable) */}
              {qr && imgSize.width > 0 && (
                (() => {
                  // Calculate size in pixels based on image width
                  const qrWidthPx = (qr.width ?? 0.15) * imgSize.width;
                  const qrX = (qr.x ?? 0) * imgSize.width;
                  const qrY = (qr.y ?? 0) * imgSize.height;
                  
                  return (
                    <div
                      className="template-detail-field-overlay template-detail-qr-overlay"
                      style={{
                        position: "absolute",
                        left: `${qrX}px`,
                        top: `${qrY}px`,
                        width: `${qrWidthPx}px`,
                        aspectRatio: "1 / 1", // Force square shape
                        padding: "8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "white",
                        border: "2px solid #10b981",
                        borderRadius: "12px",
                        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                        boxSizing: "border-box",
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: `${getEffectiveFontSize(14, naturalImgSize.height, imgSize.height)}px`,
                          fontWeight: "600",
                          color: "#059669",
                          textAlign: "center",
                          border: "2px dashed #10b981",
                          borderRadius: "8px",
                          padding: "4px",
                        }}
                      >
                        QR<br/>Code
                      </div>
                    </div>
                  );
                })()
              )}

              {/* Certificate ID preview overlay (non-editable) */}
              {certIdCfg && (
                <div
                  className="template-detail-field-overlay template-detail-certid-overlay"
                  style={{
                    left: `${(certIdCfg.x ?? 0) * 100}%`,
                    top: `${(certIdCfg.y ?? 0) * 100}%`,
                    width: `${(certIdCfg.width ?? 0.3) * 100}%`,
                    height: `${(certIdCfg.height ?? 0.06) * 100}%`,
                    fontSize: `${getEffectiveFontSize(certIdCfg.fontSize ?? 14, naturalImgSize.height, imgSize.height)}px`,
                    color: certIdCfg.fontColor || "#111827",
                    fontWeight: certIdCfg.fontWeight || "500",
                    fontStyle: certIdCfg.fontStyle || "normal",
                    fontFamily: "Arial, system-ui, sans-serif",
                    textAlign: certIdCfg.textAlign || "left",
                    display: "flex",
                    alignItems: "center",
                    justifyContent:
                      certIdCfg.textAlign === "center"
                        ? "center"
                        : certIdCfg.textAlign === "right"
                        ? "flex-end"
                        : "flex-start",
                    padding: "4px 8px", // Match backend and editor
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  ABC12345XY
                </div>
              )}
            </div>
          </div>

          <div className="template-detail-actions">
            <button
              type="button"
              className="btn-pill btn-primary"
              onClick={handleDownloadSampleCsv}
            >
              Download Sample CSV
            </button>
            <button
              type="button"
              className="btn-pill btn-dark"
              onClick={openGenerateModal}
            >
              Generate Batch Certificate
            </button>
            <button
              type="button"
              className="btn-pill btn-light"
              onClick={handleDownloadTemplateFile}
            >
              Download Template
            </button>
          </div>

          <p className="template-detail-hint">
            The sample CSV will include <strong>Email</strong> and one column
            for each field label configured in this template.
          </p>
        </section>

        {/* RIGHT: Batches table */}
        <section className="template-detail-right template-detail-card">
          <div className="template-detail-right-header">
            <h3>Batches</h3>
            <p className="template-detail-hint">
              Each batch represents one CSV upload and its generated
              certificates.
            </p>
          </div>

          {loadingBatches ? (
            <p className="template-detail-hint">Loading batches...</p>
          ) : batches.length === 0 ? (
            <p className="template-detail-hint">
              No batches yet. Generate your first batch using the button on the
              left.
            </p>
          ) : (
            <table className="batches-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Batch</th>
                  <th>Total Certificates</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b, index) => (
                  <tr key={b.batchCode || index}>
                    <td>{index + 1}</td>
                    <td>
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => goToBatch(b.batchCode)}
                      >
                        {b.name}
                      </button>
                    </td>
                    <td>{b.totalCount}</td>
                    <td>{formatDate(b.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>

      <footer className="templates-footer">
        <span>© 2025 Masai School. All Rights Reserved.</span>
      </footer>

      {/* Generate Batch Modal */}
      {showGenerateModal && (
        <div className="modal-backdrop" onClick={closeGenerateModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Generate Batch Certificates</h2>

            <form className="modal-form" onSubmit={handleGenerateBatch}>
              <label className="modal-label">
                Batch Name
                <input
                  className="modal-input"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  placeholder="e.g., Send Slot 1"
                  disabled={isGenerating}
                />
              </label>

              <label className="modal-label">
                Upload CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="modal-input"
                  onChange={handleCsvChange}
                  disabled={isGenerating}
                />
              </label>
              <p className="small-note">
                CSV must follow the same structure as the sample CSV: first
                column <strong>Email</strong>, remaining columns matching field
                labels exactly.
              </p>

              {isGenerating && (
                <div className="progress-wrapper">
                  <div className="progress-bar">
                    <div
                      className="progress-bar-inner"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="small-note">
                    Generating certificates... Please do not close this modal.
                  </p>
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-pill btn-light"
                  onClick={closeGenerateModal}
                  disabled={isGenerating}
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="btn-pill btn-primary"
                  disabled={isGenerating}
                >
                  {isGenerating ? "Generating..." : "Generate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}