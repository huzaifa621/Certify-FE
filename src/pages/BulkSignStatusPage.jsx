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

  if (loading) {
    return (
      <div className="templates-page">
        <header style={{
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#fff',
          padding: '20px 0'
        }}>
          <div style={{
            maxWidth: '80%',
            margin: '0 auto',
            textAlign: 'center'
          }}>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Bulk Sign Status</h1>
          </div>
        </header>
        <main style={{ maxWidth: '80%', margin: '40px auto', padding: '0 40px' }}>
          <p style={{ textAlign: 'center', color: '#6b7280' }}>Loading...</p>
        </main>
      </div>
    );
  }

  if (!bulkSign) {
    return (
      <div className="templates-page">
        <header style={{
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#fff',
          padding: '20px 0'
        }}>
          <div style={{
            maxWidth: '80%',
            margin: '0 auto',
            textAlign: 'center'
          }}>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Bulk Sign Status</h1>
          </div>
        </header>
        <main style={{ maxWidth: '80%', margin: '40px auto', padding: '0 40px' }}>
          <p style={{ textAlign: 'center', color: '#6b7280' }}>Event not found</p>
        </main>
      </div>
    );
  }

  const { progress, certificates, batch, status, expiresAt } = bulkSign;
  const isExpired = new Date(expiresAt) < new Date() || status === 'expired';
  const isCompleted = status === 'completed' || progress.percentage === 100;

  return (
    <div className="templates-page" style={{ backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      {/* Header: Back button (left) + Title (center) */}
      <header style={{
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: '#fff',
        padding: '20px 0'
      }}>
        <div style={{
          maxWidth: '80%',
          margin: '0 auto',
          padding: '0 40px',
          display: 'flex',
          alignItems: 'center',
          position: 'relative'
        }}>
          <button onClick={handleBack} className="btn-pill btn-light">
            ← Back to Batch
          </button>
          <h1 style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            margin: 0,
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#111827'
          }}>
            Bulk Sign Status
          </h1>
        </div>
      </header>

      {/* Main Content - 80% width, centered */}
      <main style={{ 
        maxWidth: '80%', 
        margin: '0 auto',
        padding: '40px'
      }}>
        {/* 1. Event Details Card - FIRST */}
        <section style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          padding: '32px',
          marginBottom: '24px'
        }}>
          <h2 style={{ 
            fontSize: '1.25rem', 
            fontWeight: 700,
            marginBottom: '24px',
            color: '#111827'
          }}>
            Event Details
          </h2>

          {/* Event Info Grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '24px',
            marginBottom: '32px'
          }}>
            <div>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '8px', fontWeight: 500 }}>
                Event Name
              </p>
              <p style={{ fontWeight: 600, fontSize: '1.1rem', color: '#111827' }}>
                {bulkSign.eventName}
              </p>
            </div>

            <div>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '8px', fontWeight: 500 }}>
                Batch
              </p>
              <p style={{ fontWeight: 600, fontSize: '1.1rem', color: '#111827' }}>
                {batch.name}
              </p>
            </div>

            <div>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '8px', fontWeight: 500 }}>
                Status
              </p>
              <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>
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
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '8px', fontWeight: 500 }}>
                Expires On
              </p>
              <p style={{ fontWeight: 600, fontSize: '1.1rem', color: '#111827' }}>
                {new Date(expiresAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{
            padding: '24px',
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              marginBottom: '12px'
            }}>
              <p style={{ fontSize: '1rem', fontWeight: 600, color: '#111827' }}>
                Signing Progress
              </p>
              <p style={{ fontSize: '1rem', fontWeight: 600, color: '#3b82f6' }}>
                {progress.signed}/{progress.total} ({progress.percentage}%)
              </p>
            </div>
            <div style={{
              width: '100%',
              height: '32px',
              backgroundColor: '#e5e7eb',
              borderRadius: '16px',
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
                  fontSize: '0.875rem',
                  fontWeight: 600
                }}
              >
                {progress.percentage > 15 && `${progress.percentage}%`}
              </div>
            </div>
            {polling && (
              <p style={{ 
                fontSize: '0.875rem', 
                color: '#6b7280', 
                marginTop: '12px',
                fontStyle: 'italic',
                textAlign: 'center'
              }}>
                🔄 Auto-refreshing every 3 seconds...
              </p>
            )}
          </div>
        </section>

        {/* 2. Signing Details Card - SECOND */}
        <section style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          padding: '32px',
          marginBottom: '24px'
        }}>
          <h2 style={{ 
            fontSize: '1.25rem', 
            fontWeight: 700,
            marginBottom: '24px',
            color: '#111827'
          }}>
            Signing Details
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
            {/* Signing Link - NO DUPLICATE */}
            <div>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '12px', fontWeight: 600 }}>
                Signing Link (Share with Faculty)
              </p>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center',
                gap: '12px',
                padding: '16px',
                backgroundColor: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}>
                <code style={{ 
                  flex: 1,
                  fontSize: '0.95rem',
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
                  className="btn-pill btn-primary"
                  style={{ padding: '10px 20px', flexShrink: 0 }}
                >
                  📋 Copy
                </button>
              </div>
            </div>

            {/* Password */}
            <div>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '12px', fontWeight: 600 }}>
                Password (Share with Faculty)
              </p>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center',
                gap: '12px',
                padding: '16px',
                backgroundColor: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}>
                <code style={{ 
                  flex: 1,
                  fontSize: '1rem',
                  fontFamily: 'monospace',
                  color: '#111827',
                  fontWeight: 700
                }}>
                  {bulkSign.password}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(bulkSign.password);
                    toast.success('Password copied!');
                  }}
                  className="btn-pill btn-primary"
                  style={{ padding: '10px 20px', flexShrink: 0 }}
                >
                  📋 Copy
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Certificates Table - Centered */}
        <section style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          padding: '32px'
        }}>
          <h2 style={{ 
            fontSize: '1.25rem', 
            fontWeight: 700,
            marginBottom: '24px',
            color: '#111827'
          }}>
            Certificates ({certificates.length})
          </h2>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ 
              width: '100%',
              borderCollapse: 'collapse',
              backgroundColor: '#fff'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb' }}>
                  <th style={{ 
                    padding: '16px', 
                    textAlign: 'left', 
                    fontSize: '0.875rem', 
                    fontWeight: 600, 
                    color: '#6b7280',
                    borderBottom: '2px solid #e5e7eb'
                  }}>
                    Email
                  </th>
                  <th style={{ 
                    padding: '16px', 
                    textAlign: 'center', 
                    fontSize: '0.875rem', 
                    fontWeight: 600, 
                    color: '#6b7280',
                    borderBottom: '2px solid #e5e7eb'
                  }}>
                    Original Certificate
                  </th>
                  <th style={{ 
                    padding: '16px', 
                    textAlign: 'center', 
                    fontSize: '0.875rem', 
                    fontWeight: 600, 
                    color: '#6b7280',
                    borderBottom: '2px solid #e5e7eb'
                  }}>
                    Signed Certificate
                  </th>
                  <th style={{ 
                    padding: '16px', 
                    textAlign: 'center', 
                    fontSize: '0.875rem', 
                    fontWeight: 600, 
                    color: '#6b7280',
                    borderBottom: '2px solid #e5e7eb'
                  }}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {certificates.map((cert, index) => {
                  const originalUrl = resolveFileUrl(cert.originalFilePath);
                  const signedUrl = cert.signedFilePath 
                    ? resolveFileUrl(cert.signedFilePath)
                    : null;

                  return (
                    <tr 
                      key={cert.certificateId} 
                      style={{ 
                        borderBottom: '1px solid #e5e7eb',
                        backgroundColor: index % 2 === 0 ? '#fff' : '#fafafa'
                      }}
                    >
                      <td style={{ 
                        padding: '20px 16px', 
                        fontSize: '0.95rem', 
                        color: '#111827',
                        fontWeight: 500
                      }}>
                        {cert.email}
                      </td>
                      <td style={{ padding: '20px 16px', textAlign: 'center' }}>
                        {originalUrl ? (
                          <a
                            href={originalUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{ display: 'inline-block' }}
                          >
                            <img
                              src={originalUrl}
                              alt={cert.email}
                              style={{ 
                                maxWidth: '140px',
                                maxHeight: '100px',
                                objectFit: 'contain',
                                border: '2px solid #e5e7eb',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                transition: 'border-color 0.2s, transform 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.borderColor = '#3b82f6';
                                e.target.style.transform = 'scale(1.05)';
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.borderColor = '#e5e7eb';
                                e.target.style.transform = 'scale(1)';
                              }}
                            />
                          </a>
                        ) : (
                          <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>No file</span>
                        )}
                      </td>
                      <td style={{ padding: '20px 16px', textAlign: 'center' }}>
                        {signedUrl ? (
                          <a
                            href={signedUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{ display: 'inline-block' }}
                          >
                            <img
                              src={signedUrl}
                              alt={cert.email}
                              style={{ 
                                maxWidth: '140px',
                                maxHeight: '100px',
                                objectFit: 'contain',
                                border: '2px solid #e5e7eb',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                transition: 'border-color 0.2s, transform 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.borderColor = '#16a34a';
                                e.target.style.transform = 'scale(1.05)';
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.borderColor = '#e5e7eb';
                                e.target.style.transform = 'scale(1)';
                              }}
                            />
                          </a>
                        ) : (
                          <span style={{ fontSize: '0.875rem', color: '#9ca3af', fontStyle: 'italic' }}>
                            Not signed yet
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '20px 16px', textAlign: 'center' }}>
                        {cert.signatureStatus === 'signed' ? (
                          <span style={{ 
                            padding: '8px 18px',
                            backgroundColor: '#dcfce7',
                            color: '#16a34a', 
                            fontWeight: 700,
                            fontSize: '0.875rem',
                            borderRadius: '20px',
                            display: 'inline-block',
                            letterSpacing: '0.5px'
                          }}>
                            SIGNED
                          </span>
                        ) : (
                          <span style={{ 
                            padding: '8px 18px',
                            backgroundColor: '#fef3c7',
                            color: '#f59e0b', 
                            fontWeight: 700,
                            fontSize: '0.875rem',
                            borderRadius: '20px',
                            display: 'inline-block',
                            letterSpacing: '0.5px'
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

      {/* Footer */}
      <footer style={{ 
        marginTop: '60px', 
        padding: '32px', 
        textAlign: 'center', 
        color: '#6b7280', 
        fontSize: '0.875rem',
        borderTop: '1px solid #e5e7eb'
      }}>
        <span>© 2025 Masai School. All Rights Reserved.</span>
      </footer>
    </div>
  );
}