// src/pages/BulkSignStatusPage.jsx
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

export default function BulkSignStatusPage() {
  const { eventCode } = useParams();
  const navigate = useNavigate();

  const [bulkSign, setBulkSign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(true);

  // Fetch bulk sign status
  const fetchStatus = async () => {
    try {
      const res = await client.get(`/bulk-sign/${eventCode}/status`);
      setBulkSign(res.data);
      setLoading(false);

      // Stop polling if expired or completed
      if (res.data.expired || res.data.status === 'completed') {
        setPolling(false);
      }
    } catch (err) {
      if (err.response?.status === 401) {
        navigate("/login", { replace: true });
      } else if (err.response?.status === 410) {
        // Event expired
        toast.error("This bulk sign event has expired");
        setPolling(false);
      } else {
        toast.error(err.response?.data?.message || "Failed to load status");
      }
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchStatus();
  }, [eventCode, navigate]);

  // Polling for live updates (every 3 seconds)
  useEffect(() => {
    if (!polling) return;

    const interval = setInterval(() => {
      fetchStatus();
    }, 3000);

    return () => clearInterval(interval);
  }, [polling, eventCode]);

  const handleBack = () => {
    if (bulkSign?.batch?.batchCode) {
      navigate(`/batch/${bulkSign.batch.batchCode}`);
    } else {
      navigate(-1);
    }
  };

  const copySigningLink = () => {
    const link = `${window.location.origin}/signing/${eventCode}`;
    navigator.clipboard.writeText(link);
    toast.success("Signing link copied to clipboard!");
  };

  if (loading) {
    return (
      <div className="templates-page">
        <header className="templates-header">
          <div className="header-content">
            <h1>Bulk Sign Status</h1>
          </div>
        </header>
        <main className="templates-main" style={{ padding: '40px 20px' }}>
          <p style={{ textAlign: 'center', color: '#6b7280' }}>Loading...</p>
        </main>
      </div>
    );
  }

  if (!bulkSign) {
    return (
      <div className="templates-page">
        <header className="templates-header">
          <div className="header-content">
            <h1>Bulk Sign Status</h1>
          </div>
        </header>
        <main className="templates-main" style={{ padding: '40px 20px' }}>
          <p style={{ textAlign: 'center', color: '#6b7280' }}>Event not found</p>
        </main>
      </div>
    );
  }

  const { progress, certificates, batch, status, expiresAt } = bulkSign;
  const isExpired = new Date(expiresAt) < new Date() || status === 'expired';
  const isCompleted = status === 'completed' || progress.percentage === 100;

  return (
    <div className="templates-page">
      <header className="templates-header">
        <div className="header-content">
          <button onClick={handleBack} className="btn-pill btn-light">
            ← Back to Batch
          </button>
          <h1>Bulk Sign Status</h1>
        </div>
      </header>

      <main className="templates-main" style={{ padding: '40px 20px' }}>
        {/* Signing Details Card */}
        <section className="template-detail-section" style={{ marginBottom: '20px' }}>
          <div className="section-header">
            <h2>Signing Details</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
            {/* Signing Link */}
            <div>
              <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px', fontWeight: 600 }}>
                Signing Link (Share with Faculty)
              </p>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                backgroundColor: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '6px'
              }}>
                <code style={{ 
                  flex: 1,
                  fontSize: '0.9rem',
                  fontFamily: 'monospace',
                  color: '#374151',
                  wordBreak: 'break-all'
                }}>
                  {window.location.origin}/signing/{eventCode}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/signing/${eventCode}`);
                    toast.success('Signing link copied!');
                  }}
                  style={{
                    padding: '6px 10px',
                    backgroundColor: 'transparent',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    color: '#6b7280'
                  }}
                  title="Copy signing link"
                >
                  📋
                </button>
              </div>
            </div>

            {/* Password */}
            <div>
              <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px', fontWeight: 600 }}>
                Password (Share with Faculty)
              </p>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                backgroundColor: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '6px'
              }}>
                <code style={{ 
                  flex: 1,
                  fontSize: '0.9rem',
                  fontFamily: 'monospace',
                  color: '#374151'
                }}>
                  {bulkSign.password}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(bulkSign.password);
                    toast.success('Password copied!');
                  }}
                  style={{
                    padding: '6px 10px',
                    backgroundColor: 'transparent',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    color: '#6b7280'
                  }}
                  title="Copy password"
                >
                  📋
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Event Info Card */}
        <section className="template-detail-section">
          <div className="section-header">
            <h2>Event Details</h2>
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '20px',
            marginBottom: '20px'
          }}>
            <div>
              <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '4px' }}>
                Event Name
              </p>
              <p style={{ fontWeight: 600, fontSize: '1rem' }}>
                {bulkSign.eventName}
              </p>
            </div>

            <div>
              <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '4px' }}>
                Batch
              </p>
              <p style={{ fontWeight: 600, fontSize: '1rem' }}>
                {batch.name}
              </p>
            </div>

            <div>
              <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '4px' }}>
                Status
              </p>
              <p style={{ fontWeight: 600, fontSize: '1rem' }}>
                {isExpired ? (
                  <span style={{ color: '#dc2626' }}>Expired</span>
                ) : isCompleted ? (
                  <span style={{ color: '#16a34a' }}>Completed</span>
                ) : (
                  <span style={{ color: '#f59e0b' }}>In Progress</span>
                )}
              </p>
            </div>

            <div>
              <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '4px' }}>
                Expires On
              </p>
              <p style={{ fontWeight: 600, fontSize: '1rem' }}>
                {new Date(expiresAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Signing Link */}
          <div style={{ 
            padding: '16px', 
            backgroundColor: '#f9fafb', 
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            marginBottom: '20px'
          }}>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px' }}>
              Signing Link
            </p>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <code style={{ 
                flex: 1,
                padding: '8px 12px', 
                backgroundColor: '#fff',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '0.9rem',
                fontFamily: 'monospace'
              }}>
                {window.location.origin}/signing/{eventCode}
              </code>
              <button
                type="button"
                className="btn-pill btn-primary"
                onClick={copySigningLink}
              >
                Copy Link
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              marginBottom: '8px'
            }}>
              <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                Signing Progress
              </p>
              <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#3b82f6' }}>
                {progress.signed}/{progress.total} ({progress.percentage}%)
              </p>
            </div>
            <div style={{
              width: '100%',
              height: '24px',
              backgroundColor: '#e5e7eb',
              borderRadius: '12px',
              overflow: 'hidden'
            }}>
              <div
                style={{
                  width: `${progress.percentage}%`,
                  height: '100%',
                  backgroundColor: isCompleted ? '#16a34a' : '#3b82f6',
                  transition: 'width 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: '0.75rem',
                  fontWeight: 600
                }}
              >
                {progress.percentage > 10 && `${progress.percentage}%`}
              </div>
            </div>
          </div>

          {polling && (
            <p style={{ 
              fontSize: '0.8rem', 
              color: '#6b7280', 
              marginTop: '12px',
              fontStyle: 'italic'
            }}>
              🔄 Auto-refreshing every 3 seconds...
            </p>
          )}
        </section>

        {/* Certificates Table */}
        <section className="template-detail-section">
          <div className="section-header">
            <h2>Certificates ({certificates.length})</h2>
          </div>

          <div className="batch-table-container">
            <table className="batch-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Original Certificate</th>
                  <th>Signed Certificate</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {certificates.map((cert) => {
                  const originalUrl = resolveFileUrl(cert.originalFilePath);
                  const signedUrl = cert.signedFilePath 
                    ? resolveFileUrl(cert.signedFilePath)
                    : null;

                  return (
                    <tr key={cert.certificateId}>
                      <td>{cert.email}</td>
                      <td>
                        {originalUrl ? (
                          <a
                            href={originalUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="batch-cert-thumb-link"
                          >
                            <img
                              src={originalUrl}
                              alt={cert.email}
                              className="batch-cert-thumb"
                            />
                          </a>
                        ) : (
                          <span className="small-note">No file</span>
                        )}
                      </td>
                      <td>
                        {signedUrl ? (
                          <a
                            href={signedUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="batch-cert-thumb-link"
                          >
                            <img
                              src={signedUrl}
                              alt={cert.email}
                              className="batch-cert-thumb"
                            />
                          </a>
                        ) : (
                          <span className="small-note" style={{ color: '#9ca3af' }}>
                            Not signed yet
                          </span>
                        )}
                      </td>
                      <td>
                        {cert.signatureStatus === 'signed' ? (
                          <span style={{ 
                            color: '#16a34a', 
                            fontWeight: 600,
                            fontSize: '0.9rem'
                          }}>
                            SIGNED
                          </span>
                        ) : (
                          <span style={{ 
                            color: '#f59e0b', 
                            fontWeight: 600,
                            fontSize: '0.9rem'
                          }}>
                            UNSIGNED
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <footer className="templates-footer">
        <span>© 2025 Masai School. All Rights Reserved.</span>
      </footer>
    </div>
  );
}