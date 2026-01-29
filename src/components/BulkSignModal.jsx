// src/components/BulkSignModal.jsx
import { useState, useRef, useEffect } from "react";
import { Rnd } from "react-rnd";
import toast from "react-hot-toast";

export default function BulkSignModal({ 
  isOpen, 
  onClose, 
  templateImage, 
  onSubmit 
}) {
  const [step, setStep] = useState(1); // 1: Name, 2: Position, 3: Password
  const [eventName, setEventName] = useState("");
  const [password, setPassword] = useState("");
  
  // Signature field state (normalized 0-1)
  const [signatureField, setSignatureField] = useState({
    x: 0.7,
    y: 0.8,
    width: 0.15,
    height: 0.1
  });

  const imageRef = useRef(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setEventName("");
      setPassword("");
      setSignatureField({
        x: 0.7,
        y: 0.8,
        width: 0.15,
        height: 0.1
      });
    }
  }, [isOpen]);

  // Measure image dimensions when it loads
  const handleImageLoad = () => {
    if (imageRef.current) {
      const rect = imageRef.current.getBoundingClientRect();
      setImageDimensions({ width: rect.width, height: rect.height });
    }
  };

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (imageRef.current) {
        const rect = imageRef.current.getBoundingClientRect();
        setImageDimensions({ width: rect.width, height: rect.height });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleNext = () => {
    if (step === 1) {
      if (!eventName.trim()) {
        toast.error("Please enter event name");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    if (!password.trim()) {
      toast.error("Please enter password");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        eventName: eventName.trim(),
        password: password.trim(),
        signatureField
      });
      onClose();
    } catch (error) {
      // Error handled by parent
    } finally {
      setIsSubmitting(false);
    }
  };

  // Convert normalized position to pixel position
  const getPixelPosition = () => {
    if (!imageDimensions.width) return { x: 0, y: 0, width: 100, height: 50 };
    
    return {
      x: signatureField.x * imageDimensions.width,
      y: signatureField.y * imageDimensions.height,
      width: signatureField.width * imageDimensions.width,
      height: signatureField.height * imageDimensions.height
    };
  };

  // Update normalized position from pixel drag
  const handleDragStop = (e, data) => {
    setSignatureField({
      ...signatureField,
      x: data.x / imageDimensions.width,
      y: data.y / imageDimensions.height
    });
  };

  // Update normalized size from pixel resize
  const handleResizeStop = (e, direction, ref, delta, position) => {
    setSignatureField({
      x: position.x / imageDimensions.width,
      y: position.y / imageDimensions.height,
      width: parseInt(ref.style.width) / imageDimensions.width,
      height: parseInt(ref.style.height) / imageDimensions.height
    });
  };

  if (!isOpen) return null;

  const pixelPos = getPixelPosition();

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-card" 
        onClick={(e) => e.stopPropagation()}
        style={{ 
          width: step === 2 ? '90vw' : '500px', 
          maxWidth: step === 2 ? '1200px' : '500px',
          maxHeight: '90vh',
          overflow: 'auto'
        }}
      >
        <h2 className="modal-title">
          Create Bulk Sign Event
        </h2>

        {/* Step 1: Event Name */}
        {step === 1 && (
          <div>
            <p style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '16px' }}>
              Enter a name for this bulk signature event. This will be displayed to faculty members.
            </p>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                fontWeight: 600, 
                marginBottom: '8px',
                fontSize: '0.9rem'
              }}>
                Event Name *
              </label>
              <input
                type="text"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="e.g., Faculty Signature Round 1"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.95rem'
                }}
                autoFocus
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-pill btn-light"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-pill btn-primary"
                onClick={handleNext}
              >
                Next: Position Signature
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Signature Field Position */}
        {step === 2 && (
          <div>
            <p style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '16px' }}>
              Drag and resize the signature field to position it on the certificate. 
              This is where faculty signatures will be placed.
            </p>

            <div style={{ 
              position: 'relative', 
              display: 'inline-block',
              marginBottom: '20px',
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              overflow: 'hidden',
              maxWidth: '100%'
            }}>
              <img
                ref={imageRef}
                src={templateImage}
                alt="Certificate template"
                onLoad={handleImageLoad}
                style={{
                  display: 'block',
                  maxWidth: '100%',
                  height: 'auto'
                }}
              />

              {imageDimensions.width > 0 && (
                <Rnd
                  size={{ width: pixelPos.width, height: pixelPos.height }}
                  position={{ x: pixelPos.x, y: pixelPos.y }}
                  onDragStop={handleDragStop}
                  onResizeStop={handleResizeStop}
                  bounds="parent"
                  minWidth={50}
                  minHeight={30}
                  style={{
                    border: '2px dashed #3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'move'
                  }}
                >
                  <div style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#3b82f6',
                    textAlign: 'center',
                    pointerEvents: 'none',
                    userSelect: 'none'
                  }}>
                    Signature
                  </div>
                </Rnd>
              )}
            </div>

            <div style={{ 
              padding: '12px', 
              backgroundColor: '#eff6ff', 
              borderRadius: '6px',
              marginBottom: '20px',
              fontSize: '0.85rem',
              color: '#1e40af'
            }}>
              <strong>Tip:</strong> Drag to move, resize from corners. Faculty signatures will appear in this area.
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-pill btn-light"
                onClick={handleBack}
              >
                Back
              </button>
              <button
                type="button"
                className="btn-pill btn-primary"
                onClick={handleNext}
              >
                Next: Set Password
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Password */}
        {step === 3 && (
          <div>
            <p style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '16px' }}>
              Set a password to protect the signing link. Share this password with faculty members.
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                fontWeight: 600, 
                marginBottom: '8px',
                fontSize: '0.9rem'
              }}>
                Password *
              </label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password for signing link"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.95rem'
                }}
                autoFocus
              />
              <p style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '6px' }}>
                This password will be required to access the signing page. Cannot be changed later.
              </p>
            </div>

            <div style={{ 
              padding: '12px', 
              backgroundColor: '#fef3c7', 
              borderRadius: '6px',
              marginBottom: '20px',
              fontSize: '0.85rem',
              color: '#92400e'
            }}>
              <strong>Important:</strong> Keep this password secure. Anyone with the link and password can sign certificates.
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-pill btn-light"
                onClick={handleBack}
                disabled={isSubmitting}
              >
                Back
              </button>
              <button
                type="button"
                className="btn-pill btn-primary"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating...' : 'Create Signing Link'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}