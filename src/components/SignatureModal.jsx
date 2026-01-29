// src/components/SignatureModal.jsx
import { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import {
  processSignatureImage,
  trimSignatureCanvas,
  applySignatureToCertificate,
  clearCanvas,
  initializeSignatureCanvas
} from "../utils/signatureUtils";

export default function SignatureModal({
  isOpen,
  onClose,
  onProceed,
  previewCertificateUrl,
  signatureField,
  templateWidth,
  templateHeight
}) {
  const [activeTab, setActiveTab] = useState("draw"); // "draw" | "upload"
  const [signatureCanvas, setSignatureCanvas] = useState(null);
  const [previewCanvas, setPreviewCanvas] = useState(null);
  const [hasSignature, setHasSignature] = useState(false);
  
  // Upload signature state
  const [uploadedFile, setUploadedFile] = useState(null);
  const [threshold, setThreshold] = useState(200); // Default threshold
  
  const canvasRef = useRef(null);
  const previewRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (isOpen && canvasRef.current && activeTab === "draw") {
      const canvas = canvasRef.current;
      initializeSignatureCanvas(canvas);
    }
  }, [isOpen, activeTab]);

  // Drawing handlers
  const startDrawing = (e) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Calculate scale factors (canvas resolution vs display size)
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Get mouse/touch position and scale to canvas coordinates
    const clientX = e.clientX || e.touches?.[0]?.clientX;
    const clientY = e.clientY || e.touches?.[0]?.clientY;
    
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    
    setLastPos({ x, y });
  };

  const draw = (e) => {
    if (!isDrawing) return;
    
    e.preventDefault(); // Prevent scrolling on touch devices
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    // Calculate scale factors (canvas resolution vs display size)
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Get mouse/touch position and scale to canvas coordinates
    const clientX = e.clientX || e.touches?.[0]?.clientX;
    const clientY = e.clientY || e.touches?.[0]?.clientY;
    
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    
    ctx.beginPath();
    ctx.moveTo(lastPos.x, lastPos.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    
    setLastPos({ x, y });
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  // Clear signature
  const handleClear = () => {
    if (canvasRef.current) {
      clearCanvas(canvasRef.current);
      initializeSignatureCanvas(canvasRef.current);
      setHasSignature(false);
      setSignatureCanvas(null);
      setPreviewCanvas(null);
      setUploadedFile(null); // Reset uploaded file
      setThreshold(200); // Reset threshold to default
    }
  };

  // Upload signature image
  const handleUploadSignature = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG or JPG)');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    // Store the file for re-processing when threshold changes
    setUploadedFile(file);
    
    // Process with current threshold
    await processUploadedSignature(file, threshold);
  };
  
  // Process uploaded signature with given threshold
  const processUploadedSignature = async (file, currentThreshold) => {
    try {
      toast.loading('Processing signature...', { id: 'process-sig' });
      
      // Process image and remove background with threshold
      const processedCanvas = await processSignatureImage(file, currentThreshold);
      
      // Draw processed image to signature canvas
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      // Clear to transparent (no background!)
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Scale image to fit canvas while maintaining aspect ratio
      const scale = Math.min(
        canvas.width / processedCanvas.width,
        canvas.height / processedCanvas.height
      ) * 0.9; // 90% to leave some margin
      
      const scaledWidth = processedCanvas.width * scale;
      const scaledHeight = processedCanvas.height * scale;
      const x = (canvas.width - scaledWidth) / 2;
      const y = (canvas.height - scaledHeight) / 2;
      
      ctx.drawImage(processedCanvas, x, y, scaledWidth, scaledHeight);
      
      setHasSignature(true);
      toast.success('Signature processed!', { id: 'process-sig' });
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Failed to process signature image', { id: 'process-sig' });
    }
  };
  
  // Handle threshold change (live update)
  const handleThresholdChange = async (e) => {
    const newThreshold = parseInt(e.target.value);
    setThreshold(newThreshold);
    
    // Re-process if file is uploaded
    if (uploadedFile) {
      await processUploadedSignature(uploadedFile, newThreshold);
    }
  };

  // Generate preview
  const handleGeneratePreview = async () => {
    if (!hasSignature || !canvasRef.current) {
      toast.error('Please add your signature first');
      return;
    }

    try {
      toast.loading('Generating preview...', { id: 'preview' });
      
      // Trim signature canvas
      const trimmed = trimSignatureCanvas(canvasRef.current);
      setSignatureCanvas(trimmed);
      
      // Apply signature to certificate
      const signedCanvas = await applySignatureToCertificate(
        previewCertificateUrl,
        trimmed,
        signatureField,
        templateWidth,
        templateHeight
      );
      
      setPreviewCanvas(signedCanvas);
      toast.success('Preview generated!', { id: 'preview' });
      
      // Scroll to preview
      setTimeout(() => {
        previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    } catch (err) {
      console.error('Preview error:', err);
      toast.error('Failed to generate preview', { id: 'preview' });
    }
  };

  // Proceed to bulk sign
  const handleProceed = () => {
    if (!signatureCanvas || !previewCanvas) {
      toast.error('Please generate preview first');
      return;
    }
    
    onProceed(signatureCanvas);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '90vw',
          maxWidth: '900px',
          maxHeight: '90vh',
          overflow: 'auto'
        }}
      >
        <h2 className="modal-title">Add Your Signature</h2>

        {/* Tabs */}
        <div style={{ 
          display: 'flex', 
          gap: '10px', 
          marginBottom: '20px',
          borderBottom: '2px solid #e5e7eb'
        }}>
          <button
            onClick={() => setActiveTab('draw')}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'draw' ? '3px solid #3b82f6' : 'none',
              color: activeTab === 'draw' ? '#3b82f6' : '#6b7280',
              fontWeight: activeTab === 'draw' ? 600 : 400,
              cursor: 'pointer',
              marginBottom: '-2px'
            }}
          >
            Sign Here
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'upload' ? '3px solid #3b82f6' : 'none',
              color: activeTab === 'upload' ? '#3b82f6' : '#6b7280',
              fontWeight: activeTab === 'upload' ? 600 : 400,
              cursor: 'pointer',
              marginBottom: '-2px'
            }}
          >
            Upload Signature
          </button>
        </div>

        {/* Draw Tab */}
        {activeTab === 'draw' && (
          <div>
            <p style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '12px' }}>
              Draw your signature using your mouse or touchscreen:
            </p>
            
            <div style={{ 
              border: '2px solid #d1d5db',
              borderRadius: '8px',
              marginBottom: '16px',
              overflow: 'hidden'
            }}>
              <canvas
                ref={canvasRef}
                width={700}
                height={200}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                style={{
                  display: 'block',
                  width: '100%',
                  cursor: 'crosshair',
                  touchAction: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <button
                type="button"
                className="btn-pill btn-light"
                onClick={handleClear}
              >
                Clear
              </button>
              <button
                type="button"
                className="btn-pill btn-primary"
                onClick={handleGeneratePreview}
                disabled={!hasSignature}
              >
                Generate Preview
              </button>
            </div>
          </div>
        )}

        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div>
            <p style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '12px' }}>
              Upload an image of your signature on white paper:
            </p>

            <div style={{ marginBottom: '20px' }}>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={handleUploadSignature}
                style={{
                  padding: '10px',
                  border: '2px dashed #d1d5db',
                  borderRadius: '8px',
                  width: '100%',
                  cursor: 'pointer'
                }}
              />
              <p style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '8px' }}>
                Supported formats: PNG, JPG (max 5MB)
              </p>
            </div>
            
            {/* Threshold Slider (only show if file uploaded) */}
            {uploadedFile && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ 
                  display: 'block', 
                  fontSize: '0.9rem', 
                  fontWeight: 600,
                  marginBottom: '8px',
                  color: '#374151'
                }}>
                  Background Removal: {threshold}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>Less</span>
                  <input
                    type="range"
                    min="150"
                    max="250"
                    value={threshold}
                    onChange={handleThresholdChange}
                    style={{
                      flex: 1,
                      height: '6px',
                      borderRadius: '3px',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  />
                  <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>More</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '6px' }}>
                  Adjust if signature appears too faint or background shows
                </p>
              </div>
            )}

            {/* Preview of uploaded signature */}
            <div style={{ 
              border: '2px solid #d1d5db',
              borderRadius: '8px',
              marginBottom: '16px',
              overflow: 'hidden',
              minHeight: '200px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(45deg, #f0f0f0 25%, transparent 25%, transparent 75%, #f0f0f0 75%, #f0f0f0), linear-gradient(45deg, #f0f0f0 25%, white 25%, white 75%, #f0f0f0 75%, #f0f0f0)',
              backgroundSize: '20px 20px',
              backgroundPosition: '0 0, 10px 10px'
            }}>
              <canvas
                ref={canvasRef}
                width={700}
                height={200}
                style={{
                  display: 'block',
                  width: '100%'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <button
                type="button"
                className="btn-pill btn-light"
                onClick={handleClear}
              >
                Clear
              </button>
              <button
                type="button"
                className="btn-pill btn-primary"
                onClick={handleGeneratePreview}
                disabled={!hasSignature}
              >
                Generate Preview
              </button>
            </div>
          </div>
        )}

        {/* Preview Section */}
        {previewCanvas && (
          <div ref={previewRef} style={{ marginTop: '30px' }}>
            <h3 style={{ 
              fontSize: '1.1rem', 
              fontWeight: 600,
              marginBottom: '12px',
              color: '#111827'
            }}>
              Preview
            </h3>
            <p style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '12px' }}>
              This is how your signed certificate will look:
            </p>
            
            <div style={{ 
              border: '2px solid #d1d5db',
              borderRadius: '8px',
              overflow: 'hidden',
              marginBottom: '20px'
            }}>
              <img
                src={previewCanvas.toDataURL()}
                alt="Certificate preview"
                style={{
                  display: 'block',
                  width: '100%',
                  height: 'auto'
                }}
              />
            </div>

            <button
              type="button"
              className="btn-pill btn-primary"
              onClick={handleProceed}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '1rem',
                fontWeight: 600
              }}
            >
              Proceed to Bulk Sign All Certificates
            </button>
          </div>
        )}

        {/* Info Alert */}
        <div style={{
          padding: '12px',
          backgroundColor: '#eff6ff',
          borderRadius: '6px',
          marginTop: '20px',
          fontSize: '0.85rem',
          color: '#1e40af'
        }}>
          <strong>Note:</strong> All certificate processing will happen on your device. 
          Please keep this window open and your internet connection active throughout the process.
        </div>

        {/* Actions */}
        <div className="modal-actions" style={{ marginTop: '20px' }}>
          <button
            type="button"
            className="btn-pill btn-light"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}