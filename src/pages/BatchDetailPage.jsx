// src/pages/BatchDetailPage.jsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import client from "../api/client";
import { API_BASE_URL } from "../config";

function resolveFileUrl(path) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE_URL}${path}`;
}

export default function BatchDetailPage() {
  const { id } = useParams(); // batchCode or _id
  const navigate = useNavigate();

  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(true);

  // Template meta (for template name & image)
  const [templateMeta, setTemplateMeta] = useState(null);

  // ---------- Load batch ----------
  useEffect(() => {
    async function fetchBatch() {
      try {
        setLoading(true);
        // backend accepts batchCode OR _id
        const res = await client.get(`/batches/${id}`);
        setBatch(res.data);
      } catch (err) {
        if (err.response?.status === 401) {
          navigate("/login", { replace: true });
        } else {
          toast.error(err.response?.data?.message || "Failed to load batch");
        }
      } finally {
        setLoading(false);
      }
    }

    fetchBatch();
  }, [id, navigate]);

  // ---------- Load template meta (name + image + fields) ----------
  useEffect(() => {
    async function fetchTemplateMeta() {
      if (!batch) return;

      // Prefer templateCode if present, fall back to _id or any templateId field
      const templateRef =
        batch.template?.templateCode || batch.template?._id || batch.templateId;

      if (!templateRef) return;

      try {
        const res = await client.get(`/templates/${templateRef}`);
        setTemplateMeta(res.data);
      } catch (err) {
        console.error("Failed to load template meta for batch", err);
      }
    }

    fetchTemplateMeta();
  }, [batch]);

  // ---------- Helpers ----------
  function formatDate(dateStr) {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleString();
  }

  function handleBack() {
    // Try to navigate back to template detail using stable templateCode
    if (batch?.template) {
      const templateId = batch.template.templateCode || batch.template._id;
      if (templateId) {
        navigate(`/templatedetail/${templateId}`);
        return;
      }
    }

    if (templateMeta) {
      const templateId = templateMeta.templateCode || templateMeta._id;
      if (templateId) {
        navigate(`/templatedetail/${templateId}`);
        return;
      }
    }

    if (batch?.templateId) {
      navigate(`/templatedetail/${batch.templateId}`);
      return;
    }

    navigate(-1);
  }

  function getCertUrl(cert) {
    const path = cert.filePath || cert.url || cert.path;
    return resolveFileUrl(path);
  }

  function getCertNameFromData(cert) {
    if (cert.name) return cert.name;
    const data = cert.data || {};
    return (
      data.Name || data["Student Name"] || data["Full Name"] || data.name || ""
    );
  }

  // TRUE download (no “open in tab”)
  async function handleDownloadCertificate(cert) {
    const url = getCertUrl(cert);
    if (!url) {
      toast.error("Certificate file not available");
      return;
    }

    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Download failed");
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = href;
      a.download = `${cert.email || "certificate"}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(href);
    } catch (err) {
      console.error(err);
      toast.error("Failed to download certificate");
    }
  }

  if (loading) {
    return (
      <div className="batch-page">
        <p style={{ padding: 24, textAlign: "center" }}>Loading batch...</p>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="batch-page">
        <p style={{ padding: 24, textAlign: "center" }}>Batch not found</p>
      </div>
    );
  }

  const certificates = batch.certificates || [];

  const batchIdDisplay = batch.batchCode || batch._id;

  // Template name + ID
  const templateName =
    templateMeta?.name ||
    batch.templateName ||
    batch.template?.name ||
    "Template";

  const templateIdDisplay =
    templateMeta?.templateCode ||
    templateMeta?._id ||
    batch.template?.templateCode ||
    batch.template?._id ||
    batch.templateId ||
    "";

  const templatePreviewUrl =
    resolveFileUrl(templateMeta?.imagePath) ||
    resolveFileUrl(batch.template?.imagePath) ||
    null;

  // Dynamic columns for all fields (from CSV row)
  let dynamicFieldLabels = [];
  if (certificates.length && certificates[0].data) {
    const keys = Object.keys(certificates[0].data);
    dynamicFieldLabels = keys.filter((key) => key.toLowerCase() !== "email");
  }

  return (
    <div className="batch-page">
      {/* Header */}
      <header className="templates-header">
        <div className="logo">masai.</div>
        <h1>Templates</h1>
        <div className="user-avatar">H</div>
      </header>

      <main className="batch-main">
        {/* LEFT: Batch meta + optional template preview */}
        <section className="batch-left batch-card">
          <div className="batch-header">
            <div>
              <h2 className="batch-title">{batch.name}</h2>
              <p className="batch-subtitle">
                Batch generated from <strong>{templateName}</strong>
              </p>
              <p className="batch-meta">
                <span>
                  <strong>Batch ID:</strong> {batchIdDisplay}
                </span>
                <br />
                {templateIdDisplay && (
                  <span>
                    <strong>Template ID:</strong> {templateIdDisplay}
                  </span>
                )}
                <br />
                <span>
                  Total certificates: {certificates.length} • Created:{" "}
                  {formatDate(batch.createdAt)}
                </span>
              </p>
            </div>
            <button
              type="button"
              className="btn-pill btn-light"
              onClick={handleBack}
            >
              Back
            </button>
          </div>

          {templatePreviewUrl && (
            <div className="batch-template-preview">
              <img
                src={templatePreviewUrl}
                alt={templateName}
                className="batch-template-image"
              />
            </div>
          )}
        </section>

        {/* RIGHT: Certificates table */}
        <section className="batch-right batch-card">
          <div className="batch-right-header">
            <h3>Certificates</h3>
            <p className="template-detail-hint">
              Each row represents a generated certificate mapped from the CSV
              row.
            </p>
          </div>

          {certificates.length === 0 ? (
            <p className="template-detail-hint">
              No certificates found in this batch.
            </p>
          ) : (
            <table className="batch-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Email</th>
                  {dynamicFieldLabels.map((label) => (
                    <th key={label}>{label}</th>
                  ))}
                  <th>Certificate</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {certificates.map((cert, index) => {
                  const url = getCertUrl(cert);
                  const fallbackName = getCertNameFromData(cert);
                  const data = cert.data || {};

                  return (
                    <tr key={cert._id || index}>
                      <td>{index + 1}</td>
                      <td>{cert.email}</td>

                      {dynamicFieldLabels.map((label) => (
                        <td key={label}>{data[label] ?? ""}</td>
                      ))}

                      <td>
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="batch-cert-thumb-link"
                          >
                            <img
                              src={url}
                              alt={fallbackName || cert.email}
                              className="batch-cert-thumb"
                            />
                          </a>
                        ) : (
                          <span className="small-note">No file</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-pill btn-primary"
                          onClick={() => handleDownloadCertificate(cert)}
                        >
                          Download
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </main>

      <footer className="templates-footer">
        <span>© 2025 Masai School. All Rights Reserved.</span>
      </footer>
    </div>
  );
}