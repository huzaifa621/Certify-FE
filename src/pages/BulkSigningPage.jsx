// src/pages/BulkSigningPage.jsx
import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";
import client from "../api/client";
import { API_BASE_URL } from "../config";
import SignatureModal from "../components/SignatureModal";
import { applySignatureToCertificate, canvasToBlob } from "../utils/signatureUtils";

function resolveFileUrl(path) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE_URL}${path}`;
}

export default function BulkSigningPage() {
  const { eventCode } = useParams();
  
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);
  
  // Event & batch data
  const [eventData, setEventData] = useState(null);
  const [certificates, setCertificates] = useState([]);
  const [progress, setProgress] = useState({ total: 0, signed: 0 });
  
  // Signature state
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureCanvas, setSignatureCanvas] = useState(null);
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentlyProcessing, setCurrentlyProcessing] = useState(null);
  
  // Polling
  const [polling, setPolling] = useState(false);
  const pollingIntervalRef = useRef(null);

  // Verify password
  const handleVerifyPassword = async (e) => {
    e.preventDefault();
    
    if (!password.trim()) {
      toast.error("Please enter password");
      return;
    }

    try {
      setVerifying(true);
      
      const res = await client.post(
        `/public/bulk-sign/${eventCode}/verify-password`,
        { password: password.trim() }
      );

      if (res.data.success) {
        setEventData(res.data);
        setIsAuthenticated(true);
        toast.success("Access granted!");
        
        // Load certificates
        loadCertificates();
        
        // Start polling if not all signed
        if (!res.data.allSigned) {
          setPolling(true);
        }
      }
    } catch (err) {
      if (err.response?.status === 401) {
        toast.error("Incorrect password");
      } else if (err.response?.status === 410) {
        toast.error("This signing event has expired");
      } else {
        toast.error(err.response?.data?.message || "Failed to verify password");
      }
    } finally {
      setVerifying(false);
    }
  };

  // Load certificates
  const loadCertificates = async () => {
    try {
      const res = await client.get(`/public/bulk-sign/${eventCode}/certificates`);
      setCertificates(res.data.certificates || []);
      setProgress(res.data.progress || { total: 0, signed: 0 });
    } catch (err) {
      console.error("Failed to load certificates:", err);
      toast.error("Failed to load certificates");
    }
  };

  // Polling for progress updates
  useEffect(() => {
    if (!polling || !isAuthenticated) return;

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const res = await client.get(`/public/bulk-sign/${eventCode}/progress`);
        setProgress({
          total: res.data.total,
          signed: res.data.signed
        });
        
        // Update certificate statuses
        setCertificates(prev => 
          prev.map(cert => ({
            ...cert,
            signatureStatus: res.data.signedCertIds?.includes(cert.certificateId)
              ? 'signed'
              : cert.signatureStatus
          }))
        );
        
        // Stop polling if all signed
        if (res.data.allSigned) {
          setPolling(false);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 3000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [polling, isAuthenticated, eventCode]);

  // Open signature modal
  const handleOpenSignatureModal = () => {
    const allSigned = certificates.every(cert => cert.signatureStatus === 'signed');
    
    if (allSigned) {
      toast.success("All certificates are already signed!");
      return;
    }
    
    setShowSignatureModal(true);
  };

  // Process all certificates with signature
  const handleProceedToBulkSign = async (signature) => {
    setSignatureCanvas(signature);
    
    const unsignedCerts = certificates.filter(
      cert => cert.signatureStatus !== 'signed'
    );
    
    if (unsignedCerts.length === 0) {
      toast.success("All certificates are already signed!");
      return;
    }

    setIsProcessing(true);
    setPolling(false); // Stop polling during processing
    
    let successCount = 0;
    let failCount = 0;
    
    toast.loading(
      `Processing ${unsignedCerts.length} certificates...`,
      { id: 'bulk-process', duration: Infinity }
    );

    for (let i = 0; i < unsignedCerts.length; i++) {
      const cert = unsignedCerts[i];
      setCurrentlyProcessing(cert.certificateId);
      
      try {
        // 1. Apply signature to certificate
        const signedCanvas = await applySignatureToCertificate(
          resolveFileUrl(cert.currentFilePath),
          signature,
          eventData.signatureField,
          800, // Assume standard template size
          600
        );
        
        // 2. Convert to blob
        const blob = await canvasToBlob(signedCanvas);
        
        // 3. Upload to server
        const formData = new FormData();
        formData.append('certificateId', cert.certificateId);
        formData.append('certificate', blob, `${cert.email}_signed.png`);
        
        await client.post(
          `/public/bulk-sign/${eventCode}/upload-signed`,
          formData,
          {
            headers: { 'Content-Type': 'multipart/form-data' }
          }
        );
        
        // 4. Update local state
        setCertificates(prev =>
          prev.map(c =>
            c.certificateId === cert.certificateId
              ? { ...c, signatureStatus: 'signed' }
              : c
          )
        );
        
        setProgress(prev => ({
          ...prev,
          signed: prev.signed + 1
        }));
        
        successCount++;
        
        // Update toast with progress
        toast.loading(
          `Signed ${successCount}/${unsignedCerts.length} certificates...`,
          { id: 'bulk-process' }
        );
        
      } catch (err) {
        console.error(`Failed to process certificate ${cert.certificateId}:`, err);
        failCount++;
        
        // Continue with next certificate even if one fails
        toast.error(
          `Failed to sign certificate for ${cert.email}`,
          { duration: 3000 }
        );
      }
    }
    
    setIsProcessing(false);
    setCurrentlyProcessing(null);
    
    // Final toast
    if (failCount === 0) {
      toast.success(
        `Successfully signed all ${successCount} certificates!`,
        { id: 'bulk-process' }
      );
    } else {
      toast.success(
        `Signed ${successCount} certificates. ${failCount} failed.`,
        { id: 'bulk-process' }
      );
    }
    
    // Resume polling
    setPolling(true);
  };

  // Password verification screen
  if (!isAuthenticated) {
    return (
      <div className="templates-page">
        <header className="templates-header">
          <div className="header-content">
            <h1>Bulk Sign Certificates</h1>
          </div>
        </header>

        <main className="templates-main" style={{ 
          padding: '40px 20px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 'calc(100vh - 200px)'
        }}>
          <div style={{ 
            maxWidth: '400px', 
            width: '100%',
            padding: '40px',
            backgroundColor: '#fff',
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: 700,
              marginBottom: '10px',
              textAlign: 'center'
            }}>
              Enter Password
            </h2>
            <p style={{ 
              fontSize: '0.9rem', 
              color: '#6b7280',
              marginBottom: '30px',
              textAlign: 'center'
            }}>
              This link is password protected. Please enter the password to continue.
            </p>

            <form onSubmit={handleVerifyPassword}>
              <div style={{ marginBottom: '20px' }}>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '1rem'
                  }}
                  autoFocus
                  disabled={verifying}
                />
              </div>

              <button
                type="submit"
                className="btn-pill btn-primary"
                disabled={verifying}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '1rem',
                  fontWeight: 600
                }}
              >
                {verifying ? 'Verifying...' : 'Access Signing Page'}
              </button>
            </form>
          </div>
        </main>

        <footer className="templates-footer">
          <span>© 2025 Masai School. All Rights Reserved.</span>
        </footer>
      </div>
    );
  }

  // Main signing interface
  const allSigned = progress.signed === progress.total && progress.total > 0;

  return (
    <div className="templates-page">
      <header className="templates-header">
        <div className="header-content">
          <h1>{eventData?.eventName || 'Bulk Sign Certificates'}</h1>
          <p style={{ fontSize: '0.9rem', color: '#6b7280', marginTop: '4px' }}>
            {eventData?.batchName}
          </p>
        </div>
      </header>

      <main className="templates-main" style={{ padding: '20px' }}>
        {/* Progress Bar */}
        <div style={{ 
          marginBottom: '20px',
          padding: '20px',
          backgroundColor: '#fff',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            marginBottom: '10px'
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>
              Signing Progress
            </h3>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#3b82f6' }}>
              {progress.signed}/{progress.total}
            </span>
          </div>
          
          <div style={{
            width: '100%',
            height: '30px',
            backgroundColor: '#e5e7eb',
            borderRadius: '15px',
            overflow: 'hidden'
          }}>
            <div
              style={{
                width: `${progress.total > 0 ? (progress.signed / progress.total) * 100 : 0}%`,
                height: '100%',
                backgroundColor: allSigned ? '#16a34a' : '#3b82f6',
                transition: 'width 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '0.85rem',
                fontWeight: 600
              }}
            >
              {progress.total > 0 && `${Math.round((progress.signed / progress.total) * 100)}%`}
            </div>
          </div>
          
          {allSigned && (
            <p style={{ 
              marginTop: '10px', 
              color: '#16a34a',
              fontWeight: 600,
              fontSize: '0.9rem'
            }}>
              ✓ All certificates signed!
            </p>
          )}
        </div>

        {/* Main Content Grid */}
        <div style={{ 
          display: 'flex',
          flexDirection: window.innerWidth <= 768 ? 'column' : 'row',
          gap: '20px',
          alignItems: 'start'
        }}>
          {/* Left: Certificate List */}
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            padding: '20px',
            maxHeight: window.innerWidth > 768 ? '70vh' : 'auto',
            overflow: 'auto',
            width: window.innerWidth > 768 ? '350px' : '100%',
            flexShrink: 0
          }}>
            <h3 style={{ 
              fontSize: '1.1rem', 
              fontWeight: 600,
              marginBottom: '16px'
            }}>
              Certificates ({certificates.length})
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {certificates.map((cert, index) => (
                <div
                  key={cert.certificateId}
                  style={{
                    padding: '12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    backgroundColor: cert.signatureStatus === 'signed' 
                      ? '#f0fdf4' 
                      : currentlyProcessing === cert.certificateId
                        ? '#fef3c7'
                        : '#fff'
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '6px'
                  }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      #{index + 1}
                    </span>
                    {cert.signatureStatus === 'signed' ? (
                      <span style={{ 
                        color: '#16a34a', 
                        fontWeight: 600,
                        fontSize: '0.75rem'
                      }}>
                        ✓ SIGNED
                      </span>
                    ) : currentlyProcessing === cert.certificateId ? (
                      <span style={{ 
                        color: '#f59e0b', 
                        fontWeight: 600,
                        fontSize: '0.75rem'
                      }}>
                        PROCESSING...
                      </span>
                    ) : (
                      <span style={{ 
                        color: '#9ca3af',
                        fontSize: '0.75rem'
                      }}>
                        NOT SIGNED
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#374151' }}>
                    {cert.email}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Certificate Preview & Actions */}
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            padding: '20px',
            flex: 1,
            minWidth: 0
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center',
              marginBottom: '20px'
            }}>
              <button
                type="button"
                onClick={handleOpenSignatureModal}
                disabled={allSigned || isProcessing}
                className="btn-pill btn-primary"
                style={{
                  padding: '16px 40px',
                  fontSize: '1.1rem',
                  fontWeight: 700
                }}
              >
                {allSigned 
                  ? '✓ All Certificates Signed'
                  : isProcessing
                    ? 'Processing...'
                    : 'Click Here to Bulk Sign'}
              </button>
            </div>

            {/* Important Warning Message */}
            <div style={{
              marginBottom: '20px',
              padding: '16px',
              backgroundColor: '#fef3c7',
              border: '2px solid #fbbf24',
              borderRadius: '8px',
              fontSize: '0.9rem',
              color: '#92400e',
              lineHeight: '1.5'
            }}>
              <strong style={{ display: 'block', marginBottom: '4px', color: '#78350f' }}>
                Important:
              </strong>
              All certificate processing happens on your device. Please keep this window open and maintain internet connectivity throughout the process.
            </div>

            <div style={{ 
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              overflow: 'hidden',
              position: 'relative'
            }}>
              {eventData?.templateImage ? (
                <>
                  <img
                    src={eventData.templateImage}
                    alt="Certificate template"
                    style={{
                      display: 'block',
                      width: '100%',
                      height: 'auto'
                    }}
                  />
                  {/* Signature Placeholder Overlay */}
                  {eventData.signatureField && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${eventData.signatureField.x * 100}%`,
                        top: `${eventData.signatureField.y * 100}%`,
                        width: `${eventData.signatureField.width * 100}%`,
                        height: `${eventData.signatureField.height * 100}%`,
                        border: '3px dashed #3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none'
                      }}
                    >
                      <span style={{
                        backgroundColor: 'rgba(59, 130, 246, 0.9)',
                        color: '#fff',
                        padding: '4px 12px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600
                      }}>
                        Signature Area
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ 
                  padding: '60px',
                  textAlign: 'center',
                  color: '#9ca3af'
                }}>
                  Certificate preview will appear here
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="templates-footer">
        <span>© 2025 Masai School. All Rights Reserved.</span>
      </footer>

      {/* Signature Modal */}
      {showSignatureModal && eventData && (
        <SignatureModal
          isOpen={showSignatureModal}
          onClose={() => setShowSignatureModal(false)}
          onProceed={handleProceedToBulkSign}
          previewCertificateUrl={eventData.templateImage}
          signatureField={eventData.signatureField}
          templateWidth={800}
          templateHeight={600}
        />
      )}
    </div>
  );
}