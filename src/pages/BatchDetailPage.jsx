import { API_BASE_URL } from "../config";

// src/pages/BatchDetailPage.jsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import client from '../api/client';
import toast from 'react-hot-toast';

export default function BatchDetailPage() {
  const { id } = useParams(); // batch id
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
        const res = await client.get(`/batches/${id}`);
        setBatch(res.data);
      } catch (err) {
        if (err.response?.status === 401) {
          navigate('/login', { replace: true });
        } else {
          toast.error(err.response?.data?.message || 'Failed to load batch');
        }
      } finally {
        setLoading(false);
      }
    }

    fetchBatch();
  }, [id, navigate]);

  // ---------- Load template meta (name + image + fields) if needed ----------
  useEffect(() => {
    async function fetchTemplateMeta() {
      if (!batch) return;
      const templateId = batch.template?._id || batch.templateId;
      if (!templateId) return;

      try {
        const res = await client.get(`/templates/${templateId}`);
        setTemplateMeta(res.data);
      } catch (err) {
        // Not critical, just log toast
        console.error('Failed to load template meta for batch', err);
      }
    }

    fetchTemplateMeta();
  }, [batch]);

  // ---------- Helpers ----------
  function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleString();
  }

  function handleBack() {
    if (batch?.template?._id) {
      navigate(`/templatedetail/${batch.template._id}`);
    } else if (batch?.templateId) {
      navigate(`/templatedetail/${batch.templateId}`);
    } else if (templateMeta?._id) {
      navigate(`/templatedetail/${templateMeta._id}`);
    } else {
      navigate(-1);
    }
  }

  function getCertUrl(cert) {
    const path = cert.filePath || cert.url || cert.path;
    if (!path) return '';
    return `${API_BASE_URL}${path}`;
  }

  function getCertNameFromData(cert) {
    if (cert.name) return cert.name;
    const data = cert.data || {};
    return (
      data.Name ||
      data['Student Name'] ||
      data['Full Name'] ||
      data.name ||
      ''
    );
  }

  // TRUE download (no “open in tab”)
  async function handleDownloadCertificate(cert) {
    const path = cert.filePath || cert.url || cert.path;
    if (!path) {
      toast.error('Certificate file not available');
      return;
    }

    const absoluteUrl = `${API_BASE_URL}${path}`;
    try {
      const res = await fetch(absoluteUrl);
      if (!res.ok) {
        throw new Error('Download failed');
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = href;
      a.download = `${cert.email || 'certificate'}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(href);
    } catch (err) {
      console.error(err);
      toast.error('Failed to download certificate');
    }
  }

  if (loading) {
    return (
      <div className="batch-page">
        <p style={{ padding: 24, textAlign: 'center' }}>Loading batch...</p>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="batch-page">
        <p style={{ padding: 24, textAlign: 'center' }}>Batch not found</p>
      </div>
    );
  }

  const certificates = batch.certificates || [];

  // 1️⃣ Template name fix
  const templateName =
    templateMeta?.name ||
    batch.templateName ||
    batch.template?.name ||
    'Template';

  const templatePreviewUrl =
    (templateMeta?.imagePath &&
      `${API_BASE_URL}${templateMeta.imagePath}`) ||
    (batch.template?.imagePath &&
      `${API_BASE_URL}${batch.template.imagePath}`) ||
    null;

  // 2️⃣ Dynamic columns for all fields (from CSV row)
  let dynamicFieldLabels = [];
  if (certificates.length && certificates[0].data) {
    const keys = Object.keys(certificates[0].data);
    dynamicFieldLabels = keys.filter(
      key => key.toLowerCase() !== 'email' // keep email separate
    );
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
                Batch generated from{' '}
                <strong>{templateName}</strong>
              </p>
              <p className="batch-meta">
                Total certificates: {certificates.length} • Created:{' '}
                {formatDate(batch.createdAt)}
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
                  {/* dynamic field headers from CSV / template fields */}
                  {dynamicFieldLabels.map(label => (
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

                      {/* dynamic field values */}
                      {dynamicFieldLabels.map(label => (
                        <td key={label}>
                          {data[label] ?? ''}
                        </td>
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
