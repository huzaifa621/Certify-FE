// src/pages/BatchDetailPage.jsx
import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import toast from "react-hot-toast";
import client from "../api/client";
import { API_BASE_URL } from "../config";
import BulkSignModal from "../components/BulkSignModal";

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

  // Verification configuration state
  const [visibleFields, setVisibleFields] = useState([]);
  const [issuedDate, setIssuedDate] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);

  // CSV Download Modal state
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvOptions, setCsvOptions] = useState({
    certificateId: true, // Default checked
    verifyLink: false,
    idLink: false,
    imageLink: false,
  });

  // Bulk Sign Modal state
  const [showBulkSignModal, setShowBulkSignModal] = useState(false);
  const [currentBulkSignEvent, setCurrentBulkSignEvent] = useState(null);
  const [allBulkSignEvents, setAllBulkSignEvents] = useState([]);

  // Table container ref for horizontal scroll detection
  const tableContainerRef = useRef(null);

  // ---------- Load batch ----------
  useEffect(() => {
    async function fetchBatch() {
      try {
        setLoading(true);
        // backend accepts batchCode OR _id
        const res = await client.get(`/batches/${id}`);
        setBatch(res.data);
        
        // Initialize verification config
        setVisibleFields(res.data.visibleVerificationFields || []);
        if (res.data.issuedOnDate) {
          // Convert to YYYY-MM-DD format for date input
          const date = new Date(res.data.issuedOnDate);
          setIssuedDate(date.toISOString().split('T')[0]);
        } else {
          setIssuedDate("");
        }
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

  // ---------- Load all bulk sign events ----------
  useEffect(() => {
    async function fetchBulkSignEvents() {
      if (!batch) return;
      
      const batchId = batch.batchCode || batch._id;
      
      try {
        const res = await client.get(`/batches/${batchId}/bulk-sign-events`);
        setAllBulkSignEvents(res.data.events || []);
      } catch (err) {
        console.error("Failed to load bulk sign events", err);
      }
    }

    fetchBulkSignEvents();
  }, [batch]);

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

  // ---------- Handle table scroll shadows ----------
  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container) return;

    function handleScroll() {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      
      // Check if scrolled from left edge
      if (scrollLeft > 10) {
        container.classList.add('scrolled-left');
      } else {
        container.classList.remove('scrolled-left');
      }
      
      // Check if scrolled from right edge
      if (scrollLeft < scrollWidth - clientWidth - 10) {
        container.classList.add('scrolled-right');
      } else {
        container.classList.remove('scrolled-right');
      }
    }

    // Initial check
    handleScroll();
    
    // Add scroll listener
    container.addEventListener('scroll', handleScroll);
    
    // Check on window resize
    window.addEventListener('resize', handleScroll);
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [batch]); // Re-run when batch changes (table content updates)

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
    // Use currentFilePath (latest version) if available, fallback to legacy filePath
    const path = cert.currentFilePath || cert.filePath || cert.url || cert.path;
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

  // Download all certificates as zip
  async function handleDownloadAllCertificates() {
    if (!batch || !batch.certificates || batch.certificates.length === 0) {
      toast.error("No certificates to download");
      return;
    }

    const batchId = batch.batchCode || batch._id || id;

    try {
      toast.loading("Preparing zip file...", { id: "download-all" });

      const res = await client.get(`/batches/${batchId}/download-all`, {
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: "application/zip" });
      const href = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = href;
      a.download = `${batch.name.replace(/\s+/g, "_")}_certificates.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(href);

      toast.success("All certificates downloaded!", { id: "download-all" });
    } catch (err) {
      console.error("Download all error:", err);
      toast.error(
        err.response?.data?.message || "Failed to download certificates",
        { id: "download-all" }
      );
    }
  }

  // Open CSV download modal
  function handleDownloadCsvLinks() {
    if (!batch || !batch.certificates || batch.certificates.length === 0) {
      toast.error("No certificates to download");
      return;
    }
    setShowCsvModal(true);
  }

  // Close CSV modal
  function closeCsvModal() {
    setShowCsvModal(false);
  }

  // Handle checkbox change
  function handleCsvOptionChange(option) {
    setCsvOptions((prev) => ({
      ...prev,
      [option]: !prev[option],
    }));
  }

  // Download CSV with selected columns
  function handleConfirmCsvDownload() {
    // Check if at least one option is selected
    const hasSelection = Object.values(csvOptions).some((val) => val);
    if (!hasSelection) {
      toast.error("Please select at least one option");
      return;
    }

    try {
      // Build CSV content
      const csvLines = [];
      
      // Build header row
      const headers = ["Email"];
      if (csvOptions.certificateId) headers.push("Certificate ID");
      if (csvOptions.verifyLink) headers.push("Verification Link");
      if (csvOptions.idLink) headers.push("ID Link");
      if (csvOptions.imageLink) headers.push("Certificate Image");
      
      csvLines.push(headers.join(","));
      
      // Base verification URL
      const baseVerifyUrl = "https://verify.masaischool.com";
      
      // Build data rows
      for (const cert of batch.certificates) {
        const row = [];
        
        // Email (always included)
        row.push(escapeCSVField(cert.email || ""));
        
        // Certificate ID
        if (csvOptions.certificateId) {
          row.push(escapeCSVField(cert.certificateId || ""));
        }
        
        // Verification Link
        if (csvOptions.verifyLink) {
          const verifyLink = `${baseVerifyUrl}/certificate/${cert.certificateId}`;
          row.push(escapeCSVField(verifyLink));
        }
        
        // ID Link
        if (csvOptions.idLink) {
          const idLink = `${baseVerifyUrl}/id/${cert.certificateId}`;
          row.push(escapeCSVField(idLink));
        }
        
        // Image Link
        if (csvOptions.imageLink) {
          row.push(escapeCSVField(cert.currentFilePath || cert.filePath || ""));
        }
        
        csvLines.push(row.join(","));
      }
      
      const csvContent = csvLines.join("\n");
      
      // Create and download file
      const blob = new Blob([csvContent], { type: "text/csv" });
      const href = URL.createObjectURL(blob);
      
      const a = document.createElement("a");
      a.href = href;
      a.download = `${batch.name.replace(/\s+/g, "_")}_links.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(href);
      
      toast.success("CSV downloaded!");
      closeCsvModal();
    } catch (err) {
      console.error("Download CSV error:", err);
      toast.error("Failed to download CSV");
    }
  }

  // Helper function to escape CSV fields
  function escapeCSVField(field) {
    if (!field) return "";
    const str = String(field);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  // ---------- Verification Configuration Handlers ----------
  
  function handleFieldToggle(fieldKey) {
    setVisibleFields((prev) => {
      if (prev.includes(fieldKey)) {
        return prev.filter((f) => f !== fieldKey);
      } else {
        return [...prev, fieldKey];
      }
    });
  }

  async function handleSaveVerificationConfig() {
    if (!batch) return;

    try {
      setSavingConfig(true);
      toast.loading("Saving configuration...", { id: "save-config" });

      const batchId = batch.batchCode || batch._id;
      
      // Prepare payload
      const payload = {
        visibleVerificationFields: visibleFields,
      };

      // Only include issuedOnDate if date is selected or if we need to clear it
      if (issuedDate) {
        payload.issuedOnDate = issuedDate;
      } else if (batch.issuedOnDate) {
        // If date was previously set but now cleared
        payload.issuedOnDate = null;
      }

      await client.put(`/batches/${batchId}/verification-config`, payload);

      toast.success("Configuration saved successfully", { id: "save-config" });
      
      // Refresh batch data
      const res = await client.get(`/batches/${batchId}`);
      setBatch(res.data);
    } catch (err) {
      console.error("Save config error:", err);
      toast.error(
        err.response?.data?.message || "Failed to save configuration",
        { id: "save-config" }
      );
    } finally {
      setSavingConfig(false);
    }
  }

  // ---------- Bulk Sign Handlers ----------

  function handleOpenBulkSignModal() {
    setShowBulkSignModal(true);
  }

  function handleCloseBulkSignModal() {
    setShowBulkSignModal(false);
  }

  async function handleCreateBulkSignEvent(data) {
    const batchId = batch.batchCode || batch._id;

    try {
      toast.loading("Creating bulk sign event...", { id: "bulk-sign-create" });

      const res = await client.post(`/batches/${batchId}/bulk-sign`, data);
      
      const eventCode = res.data.eventCode;
      const signingUrl = `${window.location.origin}/signing/${eventCode}`;

      toast.success("Bulk sign event created!", { id: "bulk-sign-create" });

      // Show success message with link
      toast.success(
        <div>
          <p style={{ fontWeight: 600, marginBottom: '8px' }}>Signing link created!</p>
          <p style={{ fontSize: '0.85rem', marginBottom: '8px' }}>
            Share this link with faculty:
          </p>
          <code style={{ 
            display: 'block',
            padding: '6px 8px',
            backgroundColor: '#f3f4f6',
            borderRadius: '4px',
            fontSize: '0.8rem',
            wordBreak: 'break-all',
            marginBottom: '8px'
          }}>
            {signingUrl}
          </code>
          <p style={{ fontSize: '0.85rem' }}>
            Password: <strong>{data.password}</strong>
          </p>
        </div>,
        { duration: 8000 }
      );

      // Store current event
      setCurrentBulkSignEvent(res.data);

      // Refresh batch to get updated data
      const batchRes = await client.get(`/batches/${batchId}`);
      setBatch(batchRes.data);

      // Refresh bulk sign events list
      const eventsRes = await client.get(`/batches/${batchId}/bulk-sign-events`);
      setAllBulkSignEvents(eventsRes.data.events || []);

    } catch (err) {
      console.error("Create bulk sign error:", err);
      toast.error(
        err.response?.data?.message || "Failed to create bulk sign event",
        { id: "bulk-sign-create" }
      );
      throw err; // Re-throw to prevent modal from closing
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

          {/* Verification Configuration */}
          <div className="batch-verification-config">
            <h3 className="config-title">Verification Page Configuration</h3>
            <p className="config-hint">
              Select which fields should be visible on the public verification page.
            </p>

            <div className="config-fields">
              {/* Certificate ID is always visible (not configurable) */}
              <div className="config-field-row">
                <label className="config-field-label disabled">
                  <input
                    type="checkbox"
                    checked={true}
                    disabled
                  />
                  <span>Certificate ID (always visible)</span>
                </label>
              </div>

              {/* Dynamic fields from template */}
              {templateMeta?.fields?.map((field) => (
                <div key={field.key} className="config-field-row">
                  <label className="config-field-label">
                    <input
                      type="checkbox"
                      checked={visibleFields.includes(field.key)}
                      onChange={() => handleFieldToggle(field.key)}
                    />
                    <span>{field.label || field.key}</span>
                  </label>
                </div>
              ))}

              {/* Issued Date field */}
              <div className="config-field-row">
                <label className="config-field-label">
                  <input
                    type="checkbox"
                    checked={visibleFields.includes('issuedDate')}
                    onChange={() => handleFieldToggle('issuedDate')}
                  />
                  <span>Issued Date</span>
                </label>
                
                {visibleFields.includes('issuedDate') && (
                  <input
                    type="date"
                    className="config-date-input"
                    value={issuedDate}
                    onChange={(e) => setIssuedDate(e.target.value)}
                  />
                )}
              </div>
            </div>

            <button
              type="button"
              className="btn-pill btn-primary"
              onClick={handleSaveVerificationConfig}
              disabled={savingConfig}
              style={{ marginTop: '16px', width: '100%' }}
            >
              {savingConfig ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>

          {/* Bulk Sign Section */}
          <div className="batch-verification-config" style={{ marginTop: '24px' }}>
            <h3 className="config-title">Bulk Sign</h3>
            <p className="config-hint">
              Create a password-protected signing link for faculty members to sign all certificates at once.
            </p>

            <button
              type="button"
              className="btn-pill btn-primary"
              onClick={handleOpenBulkSignModal}
              style={{ marginTop: '16px', width: '100%' }}
            >
              Create Signing Link
            </button>

            {allBulkSignEvents.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px' }}>
                  Signing Events:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {allBulkSignEvents.map((event) => (
                    <Link
                      key={event.eventCode}
                      to={`/bulk-sign-status/${event.eventCode}`}
                      style={{
                        display: 'block',
                        padding: '8px 0',
                        color: event.expired ? '#9ca3af' : '#3b82f6',
                        textDecoration: 'none',
                        fontSize: '0.9rem',
                        transition: 'color 0.2s',
                        cursor: event.expired ? 'default' : 'pointer'
                      }}
                      onMouseEnter={(e) => {
                        if (!event.expired) {
                          e.target.style.color = '#2563eb';
                          e.target.style.textDecoration = 'underline';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.color = event.expired ? '#9ca3af' : '#3b82f6';
                        e.target.style.textDecoration = 'none';
                      }}
                    >
                      {event.eventName}
                      {event.expired && (
                        <span style={{ 
                          marginLeft: '8px', 
                          fontSize: '0.75rem',
                          color: '#6b7280',
                          fontWeight: 600
                        }}>
                          (Expired)
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* RIGHT: Certificates table */}
        <section className="batch-right batch-card">
          <div className="batch-right-header">
            <div>
              <h3>Certificates</h3>
              <p className="template-detail-hint">
                Each row represents a generated certificate mapped from the CSV
                row.
              </p>
            </div>
            {certificates.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-pill btn-primary"
                  onClick={handleDownloadAllCertificates}
                >
                  Download All ({certificates.length})
                </button>
                <button
                  type="button"
                  className="btn-pill btn-dark"
                  onClick={handleDownloadCsvLinks}
                  title="Download CSV with email and image URLs"
                >
                  Download CSV Links
                </button>
              </div>
            )}
          </div>

          {certificates.length === 0 ? (
            <p className="template-detail-hint">
              No certificates found in this batch.
            </p>
          ) : (
            <div className="batch-table-container" ref={tableContainerRef}>
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
            </div>
          )}
        </section>
      </main>

      <footer className="templates-footer">
        <span>© 2025 Masai School. All Rights Reserved.</span>
      </footer>

      {/* CSV Download Options Modal */}
      {showCsvModal && (
        <div className="modal-backdrop" onClick={closeCsvModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ width: '480px', maxWidth: '90vw' }}>
            <h2 className="modal-title">Select CSV Columns</h2>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '16px' }}>
              Email column will always be included. Select additional columns:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Certificate ID */}
              <label style={{ 
                display: 'flex', 
                alignItems: 'flex-start',
                gap: '10px',
                cursor: 'pointer',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                backgroundColor: csvOptions.certificateId ? '#eff6ff' : 'transparent'
              }}>
                <input
                  type="checkbox"
                  checked={csvOptions.certificateId}
                  onChange={() => handleCsvOptionChange('certificateId')}
                  style={{ marginTop: '3px', cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>
                    Certificate ID
                  </div>
                </div>
              </label>

              {/* Verification Link */}
              <label style={{ 
                display: 'flex', 
                alignItems: 'flex-start',
                gap: '10px',
                cursor: 'pointer',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                backgroundColor: csvOptions.verifyLink ? '#eff6ff' : 'transparent'
              }}>
                <input
                  type="checkbox"
                  checked={csvOptions.verifyLink}
                  onChange={() => handleCsvOptionChange('verifyLink')}
                  style={{ marginTop: '3px', cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>
                    https://verify.masaischool.com/certificate/{'{certificateID}'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                    This will redirect to the verification page. This is the same link which QR code redirects.
                  </div>
                </div>
              </label>

              {/* ID Link */}
              <label style={{ 
                display: 'flex', 
                alignItems: 'flex-start',
                gap: '10px',
                cursor: 'pointer',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                backgroundColor: csvOptions.idLink ? '#eff6ff' : 'transparent'
              }}>
                <input
                  type="checkbox"
                  checked={csvOptions.idLink}
                  onChange={() => handleCsvOptionChange('idLink')}
                  style={{ marginTop: '3px', cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>
                    https://verify.masaischool.com/id/{'{certificateID}'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                    This link will only display the certificate image, nothing else. This is perfect selection for the score cards.
                  </div>
                </div>
              </label>

              {/* Certificate Image Link */}
              <label style={{ 
                display: 'flex', 
                alignItems: 'flex-start',
                gap: '10px',
                cursor: 'pointer',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                backgroundColor: csvOptions.imageLink ? '#eff6ff' : 'transparent'
              }}>
                <input
                  type="checkbox"
                  checked={csvOptions.imageLink}
                  onChange={() => handleCsvOptionChange('imageLink')}
                  style={{ marginTop: '3px', cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>
                    Certificate Image Link
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                    Direct Supabase URL to the certificate image
                  </div>
                </div>
              </label>
            </div>

            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button
                type="button"
                className="btn-pill btn-light"
                onClick={closeCsvModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-pill btn-primary"
                onClick={handleConfirmCsvDownload}
              >
                Download CSV
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Sign Modal */}
      {showBulkSignModal && templateMeta && (
        <BulkSignModal
          isOpen={showBulkSignModal}
          onClose={handleCloseBulkSignModal}
          templateImage={templateMeta.imagePath}
          onSubmit={handleCreateBulkSignEvent}
        />
      )}
    </div>
  );
}