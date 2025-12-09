// src/pages/TemplateEditorPage.jsx

import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import client from "../api/client";
import toast from "react-hot-toast";
import { Rnd } from "react-rnd";
import { API_BASE_URL } from "../config";

function resolveImageUrl(path) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE_URL}${path}`;
}

export default function TemplateEditorPage() {
  // NOTE: URL is /template/:id/edit where :id is actually the templateCode
  const { id } = useParams();
  const navigate = useNavigate();

  const [template, setTemplate] = useState(null);
  const [fields, setFields] = useState([]);
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // QR config (normalized 0–1)
  const [qrConfig, setQrConfig] = useState({
    enabled: false,
    x: 0.8,
    y: 0.8,
    width: 0.15,
    height: 0.15,
  });

  // Certificate ID config (normalized 0–1 + typography)
  const [certificateIdConfig, setCertificateIdConfig] = useState({
    enabled: false,
    x: 0.1,
    y: 0.05,
    width: 0.3,
    height: 0.06,
    fontSize: 14,
    fontWeight: 500,
    fontColor: "#ffffff",
    textAlign: "left",
    fontStyle: "normal",
  });

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Add field drafts
  const [addLabel, setAddLabel] = useState("");
  const [addSampleText, setAddSampleText] = useState("");

  // Edit field draft
  const [editFieldDraft, setEditFieldDraft] = useState(null);

  // Image size
  const imgRef = useRef(null);
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });
  const [naturalImgSize, setNaturalImgSize] = useState({ width: 0, height: 0 });

  /* -------------------- Utility -------------------- */

  function clamp01(value) {
    const v = Number(value);
    if (isNaN(v)) return 0;
    return Math.max(0, Math.min(1, v));
  }

  // Dynamic font size scaling - matches backend logic exactly
  // Font sizes scale proportionally to template height
  // Reference: 800px height template (standard preview size)
  function getEffectiveFontSize(configuredSize, naturalHeight, displayHeight) {
    if (!naturalHeight || !displayHeight) return configuredSize || 24;
    
    const REFERENCE_HEIGHT = 800;
    
    // Calculate what the font size should be on the actual template
    const scaleFactor = naturalHeight / REFERENCE_HEIGHT;
    const scaledFontSize = (configuredSize || 24) * scaleFactor;
    
    // Now scale it down to display size for preview
    const displayScaleFactor = displayHeight / naturalHeight;
    const displayFontSize = scaledFontSize * displayScaleFactor;
    
    return Math.round(displayFontSize);
  }

  /* -------------------- Load Template -------------------- */

  useEffect(() => {
    async function loadTemplate() {
      try {
        setLoading(true);
        // Backend: GET /templates/:id where :id is templateCode
        const res = await client.get(`/templates/${id}`);
        const t = res.data;

        setTemplate(t);
        let loaded = t.fields || [];

        // If no fields, add default Name field
        if (loaded.length === 0) {
          loaded = [
            {
              _id: `tmp-${Date.now()}`,
              key: "Name",
              label: "Name",
              sampleText: "Sample Name",
              x: 0.12,
              y: 0.18,
              width: 0.35,
              height: 0.08,
              fontSize: 32,
              fontColor: "#111827",
              fontWeight: "600",
              fontFamily: "Arial",
              textAlign: "center",
            },
          ];
        }

        setFields(loaded);
        setSelectedFieldId(loaded[0]._id);

        // Load QR config if present
        if (t.qrConfig && t.qrConfig.enabled) {
          setQrConfig({
            enabled: true,
            x: clamp01(t.qrConfig.x ?? 0.8),
            y: clamp01(t.qrConfig.y ?? 0.8),
            width: clamp01(t.qrConfig.width ?? 0.15),
            height: clamp01(t.qrConfig.height ?? 0.15),
          });
        } else {
          setQrConfig((prev) => ({ ...prev, enabled: false }));
        }

        // Load Certificate ID config if present
        if (t.certificateIdConfig && t.certificateIdConfig.enabled) {
          const c = t.certificateIdConfig;
          setCertificateIdConfig({
            enabled: true,
            x: clamp01(c.x ?? 0.1),
            y: clamp01(c.y ?? 0.05),
            width: clamp01(c.width ?? 0.3),
            height: clamp01(c.height ?? 0.06),
            fontSize: c.fontSize ?? 14,
            fontWeight: c.fontWeight ?? 500,
            fontColor: c.fontColor || "#ffffff",
            textAlign: c.textAlign || "left",
            fontStyle: c.fontStyle || "normal",
          });
        } else {
          setCertificateIdConfig((prev) => ({ ...prev, enabled: false }));
        }
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

    loadTemplate();
  }, [id, navigate]);

  /* -------------------- Image Loaded -------------------- */

  function handleImageLoad() {
    if (!imgRef.current) return;
    setImgSize({
      width: imgRef.current.clientWidth,
      height: imgRef.current.clientHeight,
    });
    // Also track the actual template dimensions (not the scaled display size)
    setNaturalImgSize({
      width: imgRef.current.naturalWidth,
      height: imgRef.current.naturalHeight,
    });
  }

  function selectField(fieldId) {
    setSelectedFieldId(fieldId);
  }

  /* -------------------- Add Field Modal -------------------- */

  function openAddFieldModal() {
    setAddLabel("");
    setAddSampleText("");
    setShowAddModal(true);
  }

  function closeAddFieldModal() {
    setShowAddModal(false);
  }

  function handleAddFieldSubmit(e) {
    e.preventDefault();

    const label = addLabel.trim();
    if (!label) return toast.error("Field label is required");

    // Unique label validation
    if (fields.some((f) => f.label === label)) {
      return toast.error("Field label must be unique");
    }

    const newField = {
      _id: `tmp-${Date.now()}`,
      key: label,
      label,
      sampleText: addSampleText.trim(),
      x: 0.12,
      y: 0.18,
      width: 0.35,
      height: 0.08,
      fontSize: 28,
      fontColor: "#111827",
      fontWeight: "500",
      fontFamily: "Arial",
      textAlign: "center",
    };

    const updated = [...fields, newField];
    setFields(updated);
    setSelectedFieldId(newField._id);
    closeAddFieldModal();
  }

  /* -------------------- Edit Field Modal -------------------- */

  function openEditFieldModal() {
    if (!selectedFieldId) return;

    const field = fields.find((f) => f._id === selectedFieldId);
    if (!field) return;

    setEditFieldDraft({ ...field });
    setShowEditModal(true);
  }

  function closeEditFieldModal() {
    setShowEditModal(false);
    setEditFieldDraft(null);
  }

  function handleEditDraftChange(key, val) {
    setEditFieldDraft((prev) => ({ ...prev, [key]: val }));
  }

  function handleEditFieldSubmit(e) {
    e.preventDefault();
    if (!editFieldDraft) return;

    const label = editFieldDraft.label.trim();
    if (!label) return toast.error("Field label is required");

    // Check unique label (excluding itself)
    const dup = fields.find(
      (f) => f._id !== editFieldDraft._id && f.label === label
    );
    if (dup) return toast.error("Field label must be unique");

    const updated = fields.map((f) =>
      f._id === editFieldDraft._id
        ? {
            ...f,
            ...editFieldDraft,
            label,
            key: label,
            fontSize: Number(editFieldDraft.fontSize) || 20,
            x: clamp01(editFieldDraft.x),
            y: clamp01(editFieldDraft.y),
            width: clamp01(editFieldDraft.width),
            height: clamp01(editFieldDraft.height),
          }
        : f
    );

    setFields(updated);
    closeEditFieldModal();
  }

  /* -------------------- Delete Field -------------------- */

  function handleDeleteSelectedField() {
    if (!selectedFieldId) return;

    const updated = fields.filter((f) => f._id !== selectedFieldId);

    setFields(updated);
    setSelectedFieldId(updated.length ? updated[0]._id : null);
    toast.success("Field deleted");
  }

  /* -------------------- Drag + Resize (Fields) -------------------- */

  function updateFieldPosition(fieldId, xPx, yPx) {
    if (!imgSize.width || !imgSize.height) return;

    const x = xPx / imgSize.width;
    const y = yPx / imgSize.height;

    setFields((prev) =>
      prev.map((f) =>
        f._id === fieldId ? { ...f, x: clamp01(x), y: clamp01(y) } : f
      )
    );
  }

  function updateFieldSize(fieldId, widthPx, heightPx, xPx, yPx) {
    if (!imgSize.width || !imgSize.height) return;

    const w = widthPx / imgSize.width;
    const h = heightPx / imgSize.height;
    const x = xPx / imgSize.width;
    const y = yPx / imgSize.height;

    setFields((prev) =>
      prev.map((f) =>
        f._id === fieldId
          ? {
              ...f,
              x: clamp01(x),
              y: clamp01(y),
              width: clamp01(w),
              height: clamp01(h),
            }
          : f
      )
    );
  }

  /* -------------------- QR: Add / Remove / Drag / Resize -------------------- */

  function handleAddQr() {
    if (qrConfig.enabled) {
      toast.error("QR Code already added");
      return;
    }

    // default bottom-right-ish
    setQrConfig({
      enabled: true,
      x: 0.8,
      y: 0.78,
      width: 0.15,
      height: 0.15,
    });
  }

  function handleRemoveQr() {
    setQrConfig((prev) => ({ ...prev, enabled: false }));
  }

  function updateQrPosition(xPx, yPx) {
    if (!imgSize.width || !imgSize.height) return;
    const x = xPx / imgSize.width;
    const y = yPx / imgSize.height;
    setQrConfig((prev) =>
      !prev.enabled ? prev : { ...prev, x: clamp01(x), y: clamp01(y) }
    );
  }

  function updateQrSize(widthPx, heightPx, xPx, yPx) {
    if (!imgSize.width || !imgSize.height) return;
    const w = widthPx / imgSize.width;
    const h = heightPx / imgSize.height;
    const x = xPx / imgSize.width;
    const y = yPx / imgSize.height;
    setQrConfig((prev) =>
      !prev.enabled
        ? prev
        : {
            ...prev,
            x: clamp01(x),
            y: clamp01(y),
            width: clamp01(w),
            height: clamp01(h),
          }
    );
  }

  /* -------------------- Certificate ID: Add / Remove / Drag / Resize -------------------- */

  function handleAddCertificateId() {
    if (certificateIdConfig.enabled) {
      toast.error("Certificate ID already added");
      return;
    }

    setCertificateIdConfig({
      enabled: true,
      x: 0.1,
      y: 0.05,
      width: 0.3,
      height: 0.06,
      fontSize: 14,
      fontWeight: 500,
      fontColor: "#ffffff",
      fontFamily: "Arial",
      textAlign: "left",
      fontStyle: "normal",
    });
  }

  function handleRemoveCertificateId() {
    setCertificateIdConfig((prev) => ({ ...prev, enabled: false }));
  }

  function updateCertificateIdPosition(xPx, yPx) {
    if (!imgSize.width || !imgSize.height) return;
    const x = xPx / imgSize.width;
    const y = yPx / imgSize.height;
    setCertificateIdConfig((prev) =>
      !prev.enabled ? prev : { ...prev, x: clamp01(x), y: clamp01(y) }
    );
  }

  function updateCertificateIdSize(widthPx, heightPx, xPx, yPx) {
    if (!imgSize.width || !imgSize.height) return;
    const w = widthPx / imgSize.width;
    const h = heightPx / imgSize.height;
    const x = xPx / imgSize.width;
    const y = yPx / imgSize.height;

    setCertificateIdConfig((prev) =>
      !prev.enabled
        ? prev
        : {
            ...prev,
            x: clamp01(x),
            y: clamp01(y),
            width: clamp01(w),
            height: clamp01(h),
          }
    );
  }

  /* -------------------- Save Template -------------------- */

  async function handleSaveTemplate() {
    try {
      setSaving(true);

      const payloadFields = fields.map((f) => ({
        key: f.label,
        label: f.label,
        sampleText: f.sampleText,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        fontSize: f.fontSize,
        fontColor: f.fontColor,
        fontWeight: f.fontWeight,
        fontFamily: f.fontFamily,
        textAlign: f.textAlign,
      }));

      const payloadQr =
        qrConfig && qrConfig.enabled
          ? {
              enabled: true,
              x: qrConfig.x,
              y: qrConfig.y,
              width: qrConfig.width,
              height: qrConfig.height,
            }
          : { enabled: false };

      const payloadCertId =
        certificateIdConfig && certificateIdConfig.enabled
          ? {
              enabled: true,
              x: certificateIdConfig.x,
              y: certificateIdConfig.y,
              width: certificateIdConfig.width,
              height: certificateIdConfig.height,
              fontSize: certificateIdConfig.fontSize,
              fontWeight: certificateIdConfig.fontWeight,
              fontColor: certificateIdConfig.fontColor,
              fontFamily: certificateIdConfig.fontFamily,
              textAlign: certificateIdConfig.textAlign,
              fontStyle: certificateIdConfig.fontStyle,
            }
          : { enabled: false };

      await client.put(`/templates/${id}/fields`, {
        fields: payloadFields,
        qrConfig: payloadQr,
        certificateIdConfig: payloadCertId,
      });

      toast.success("Template fields saved");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  /* -------------------- Back -------------------- */

  function handleBack() {
    navigate("/");
  }

  /* -------------------- UI Rendering -------------------- */

  if (loading) {
    return (
      <div className="template-editor-page">
        <p style={{ padding: 24, textAlign: "center" }}>Loading template...</p>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="template-editor-page">
        <p style={{ padding: 24, textAlign: "center" }}>Template not found</p>
      </div>
    );
  }

  const selectedField = fields.find((f) => f._id === selectedFieldId);

  return (
    <div className="template-editor-page">
      {/* Header */}
      <header className="templates-header">
        <div className="logo">masai.</div>
        <h1>Templates</h1>
        <div className="user-avatar">H</div>
      </header>

      <div className="template-editor-main">
        {/* Left: Canvas */}
        <div className="template-editor-canvas-wrapper">
          <div className="template-editor-canvas-inner">
            <img
              ref={imgRef}
              src={resolveImageUrl(template.imagePath)}
              alt={template.name}
              className="template-editor-image"
              onLoad={handleImageLoad}
            />

            {/* All fields */}
            {imgSize.width > 0 &&
              fields.map((field) => {
                const isSelected = field._id === selectedFieldId;

                const widthPx = field.width * imgSize.width;
                const heightPx = field.height * imgSize.height;
                const xPx = field.x * imgSize.width;
                const yPx = field.y * imgSize.height;

                const textStyle = {
                  fontSize: `${getEffectiveFontSize(field.fontSize, naturalImgSize.height, imgSize.height)}px`,
                  color: field.fontColor,
                  fontWeight: field.fontWeight,
                  fontFamily: field.fontFamily,
                  textAlign: field.textAlign,
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent:
                    field.textAlign === "center"
                      ? "center"
                      : field.textAlign === "right"
                      ? "flex-end"
                      : "flex-start",
                  padding: "4px 6px",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                };

                return (
                  <Rnd
                    key={field._id}
                    size={{ width: widthPx, height: heightPx }}
                    position={{ x: xPx, y: yPx }}
                    bounds="parent"
                    onClick={() => selectField(field._id)}
                    onDragStop={(e, d) =>
                      updateFieldPosition(field._id, d.x, d.y)
                    }
                    onResizeStop={(e, direction, ref, delta, pos) =>
                      updateFieldSize(
                        field._id,
                        ref.offsetWidth,
                        ref.offsetHeight,
                        pos.x,
                        pos.y
                      )
                    }
                    enableResizing={{
                      top: true,
                      right: true,
                      bottom: true,
                      left: true,
                      topRight: true,
                      bottomRight: true,
                      bottomLeft: true,
                      topLeft: true,
                    }}
                    resizeHandleStyles={{
                      bottomRight: {
                        width: "14px",
                        height: "14px",
                        background: "#2563eb",
                        borderRadius: "999px",
                        bottom: "-7px",
                        right: "-7px",
                      },
                    }}
                    style={{
                      zIndex: isSelected ? 5 : 4,
                      border: isSelected
                        ? "2px solid rgba(37, 99, 235, 0.8)"
                        : "2px dashed rgba(37, 99, 235, 0.6)",
                      background: "rgba(37, 99, 235, 0.05)",
                      borderRadius: "8px",
                    }}
                  >
                    <div style={textStyle}>
                      {field.sampleText || field.label}
                    </div>
                  </Rnd>
                );
              })}

            {/* QR placeholder */}
            {imgSize.width > 0 && qrConfig.enabled && (
              <Rnd
                size={{
                  width: qrConfig.width * imgSize.width,
                  height: qrConfig.width * imgSize.width, // enforce square
                }}
                position={{
                  x: qrConfig.x * imgSize.width,
                  y: qrConfig.y * imgSize.height,
                }}
                bounds="parent"
                lockAspectRatio={1}
                onDragStop={(e, d) => updateQrPosition(d.x, d.y)}
                onResizeStop={(e, direction, ref, delta, pos) => {
                  const sizePx = Math.min(ref.offsetWidth, ref.offsetHeight);
                  updateQrSize(sizePx, sizePx, pos.x, pos.y);
                }}
                enableResizing={{
                  bottomRight: true,
                }}
                resizeHandleStyles={{
                  bottomRight: {
                    width: "16px",
                    height: "16px",
                    background: "#16a34a",
                    borderRadius: "999px",
                    bottom: "-8px",
                    right: "-8px",
                  },
                }}
                style={{
                  zIndex: 6,
                  border: "2px solid rgba(22, 163, 74, 0.9)",
                  background: "white",
                  borderRadius: "6px",
                  padding: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <img
                  src="data:image/svg+xml;utf8,
        <svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'>
          <rect width='200' height='200' fill='white'/>
          <rect x='20' y='20' width='50' height='50' fill='black'/>
          <rect x='130' y='20' width='50' height='50' fill='black'/>
          <rect x='20' y='130' width='50' height='50' fill='black'/>
          <rect x='80' y='80' width='40' height='40' fill='black'/>
          <rect x='130' y='130' width='50' height='50' fill='black'/>
        </svg>"
                  alt="QR Preview"
                  style={{ width: "100%", height: "100%" }}
                />
              </Rnd>
            )}

            {/* Certificate ID placeholder */}
            {imgSize.width > 0 && certificateIdConfig.enabled && (
              <Rnd
                size={{
                  width: certificateIdConfig.width * imgSize.width,
                  height: certificateIdConfig.height * imgSize.height,
                }}
                position={{
                  x: certificateIdConfig.x * imgSize.width,
                  y: certificateIdConfig.y * imgSize.height,
                }}
                bounds="parent"
                onDragStop={(e, d) => updateCertificateIdPosition(d.x, d.y)}
                onResizeStop={(e, direction, ref, delta, pos) =>
                  updateCertificateIdSize(
                    ref.offsetWidth,
                    ref.offsetHeight,
                    pos.x,
                    pos.y
                  )
                }
                enableResizing={{
                  top: true,
                  right: true,
                  bottom: true,
                  left: true,
                  topRight: true,
                  bottomRight: true,
                  bottomLeft: true,
                  topLeft: true,
                }}
                resizeHandleStyles={{
                  bottomRight: {
                    width: "14px",
                    height: "14px",
                    background: "#f97316",
                    borderRadius: "999px",
                    bottom: "-7px",
                    right: "-7px",
                  },
                }}
                style={{
                  zIndex: 7,
                  border: "2px solid rgba(249, 115, 22, 0.8)",
                  background: "rgba(249, 115, 22, 0.06)",
                  borderRadius: "8px",
                  padding: "2px 4px",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    fontSize: `${getEffectiveFontSize(certificateIdConfig.fontSize, naturalImgSize.height, imgSize.height)}px`,
                    fontWeight: certificateIdConfig.fontWeight,
                    fontStyle: certificateIdConfig.fontStyle,
                    fontFamily: "Arial, system-ui, sans-serif",
                    color: certificateIdConfig.fontColor,
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    textAlign: certificateIdConfig.textAlign,
                    justifyContent:
                      certificateIdConfig.textAlign === "center"
                        ? "center"
                        : certificateIdConfig.textAlign === "right"
                        ? "flex-end"
                        : "flex-start",
                  }}
                >
                  {/* Only raw certificate string as preview */}
                  ABC12345XY
                </div>
              </Rnd>
            )}
          </div>
        </div>

        {/* Right: Sidebar */}
        <div className="template-editor-sidebar">
          {/* Top Card */}
          <div className="template-editor-card">
            <div className="template-editor-actions">
              <button
                className="btn-pill btn-primary"
                onClick={openAddFieldModal}
              >
                Add New Field
              </button>

              {!qrConfig.enabled ? (
                <button
                  className="btn-pill btn-light"
                  type="button"
                  onClick={handleAddQr}
                >
                  Add QR Code
                </button>
              ) : (
                <button
                  className="btn-pill btn-danger"
                  type="button"
                  onClick={handleRemoveQr}
                >
                  Remove QR
                </button>
              )}

              {!certificateIdConfig.enabled ? (
                <button
                  className="btn-pill btn-light"
                  type="button"
                  onClick={handleAddCertificateId}
                >
                  Add Certificate ID
                </button>
              ) : (
                <button
                  className="btn-pill btn-danger"
                  type="button"
                  onClick={handleRemoveCertificateId}
                >
                  Remove Certificate ID
                </button>
              )}

              <button
                className="btn-pill btn-dark"
                onClick={handleSaveTemplate}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Template"}
              </button>
              <button className="btn-pill btn-light" onClick={handleBack}>
                Back
              </button>
            </div>

            <p className="template-editor-hint">
              Before saving, ensure you have placed all fields, the QR (if
              added), and the Certificate ID (if added) correctly.
            </p>
          </div>

          {/* Field List */}
          <div className="template-editor-card">
            <p className="template-editor-hint">
              Click a field to select, move or edit.
            </p>

            <div className="field-list">
              {fields.map((f) => (
                <div
                  key={f._id}
                  className={
                    "field-item" +
                    (f._id === selectedFieldId ? " selected" : "")
                  }
                  onClick={() => selectField(f._id)}
                >
                  <div className="field-item-label">{f.label}</div>
                  <div className="field-item-text">
                    {f.sampleText || "No sample text"}
                  </div>
                </div>
              ))}
              {fields.length === 0 && (
                <p className="small-note">No fields added yet.</p>
              )}
            </div>

            {selectedField && (
              <div className="selected-field-actions">
                <button
                  className="btn-pill btn-dark"
                  onClick={openEditFieldModal}
                >
                  Edit Selected Field
                </button>
                <button
                  className="btn-pill btn-danger"
                  onClick={handleDeleteSelectedField}
                >
                  Delete Selected Field
                </button>
              </div>
            )}
          </div>

          {/* Certificate ID Settings */}
          {certificateIdConfig.enabled && (
            <div className="template-editor-card">
              <h3 className="template-editor-subtitle">
                Certificate ID Settings
              </h3>
              <p className="template-editor-hint">
                Adjust how the Certificate ID text appears on the certificate.
              </p>

              <label className="modal-label">
                Font Size (px)
                <input
                  type="number"
                  className="modal-input"
                  value={certificateIdConfig.fontSize}
                  onChange={(e) =>
                    setCertificateIdConfig((prev) => ({
                      ...prev,
                      fontSize: Number(e.target.value) || 12,
                    }))
                  }
                />
              </label>

              <label className="modal-label">
                Font Weight
                <input
                  className="modal-input"
                  value={certificateIdConfig.fontWeight}
                  onChange={(e) =>
                    setCertificateIdConfig((prev) => ({
                      ...prev,
                      fontWeight: e.target.value,
                    }))
                  }
                  placeholder="300, 400, 500, 600..."
                />
              </label>

              <label className="modal-label">
                Font Color
                <input
                  className="modal-input"
                  value={certificateIdConfig.fontColor}
                  onChange={(e) =>
                    setCertificateIdConfig((prev) => ({
                      ...prev,
                      fontColor: e.target.value,
                    }))
                  }
                  placeholder="#ffffff"
                />
              </label>

              <label className="modal-label">
                Font Style
                <select
                  className="modal-select"
                  value={certificateIdConfig.fontStyle}
                  onChange={(e) =>
                    setCertificateIdConfig((prev) => ({
                      ...prev,
                      fontStyle: e.target.value,
                    }))
                  }
                >
                  <option value="normal">Normal</option>
                  <option value="italic">Italic</option>
                  <option value="oblique">Oblique</option>
                </select>
              </label>

              <label className="modal-label">
                Font Family
                <select
                  className="modal-select"
                  value={certificateIdConfig.fontFamily || "Arial"}
                  onChange={(e) =>
                    setCertificateIdConfig((prev) => ({
                      ...prev,
                      fontFamily: e.target.value,
                    }))
                  }
                >
                  <option value="Arial">Arial</option>
                  <option value="Caladea">Caladea</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Times">Times Roman</option>
                  <option value="Courier New">Courier New</option>
                  <option value="Verdana">Verdana</option>
                </select>
              </label>

              <label className="modal-label">
                Text Align
                <select
                  className="modal-select"
                  value={certificateIdConfig.textAlign}
                  onChange={(e) =>
                    setCertificateIdConfig((prev) => ({
                      ...prev,
                      textAlign: e.target.value,
                    }))
                  }
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </label>
            </div>
          )}
        </div>
      </div>

      {/* -------------------- Add Field Modal -------------------- */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={closeAddFieldModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Add New Field</h2>

            <form className="modal-form" onSubmit={handleAddFieldSubmit}>
              <label className="modal-label">
                Field Label
                <input
                  className="modal-input"
                  value={addLabel}
                  onChange={(e) => setAddLabel(e.target.value)}
                  placeholder="Name, Course, Date..."
                />
              </label>

              <label className="modal-label">
                Sample Text
                <input
                  className="modal-input"
                  value={addSampleText}
                  onChange={(e) => setAddSampleText(e.target.value)}
                  placeholder="e.g., Mohit Sharma"
                />
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-pill btn-light"
                  onClick={closeAddFieldModal}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-pill btn-primary">
                  Add Field
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------- Edit Field Modal -------------------- */}
      {showEditModal && editFieldDraft && (
        <div className="modal-backdrop" onClick={closeEditFieldModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Edit Field</h2>

            <form className="modal-form" onSubmit={handleEditFieldSubmit}>
              <label className="modal-label">
                Field Label
                <input
                  className="modal-input"
                  value={editFieldDraft.label}
                  onChange={(e) =>
                    handleEditDraftChange("label", e.target.value)
                  }
                />
              </label>

              <label className="modal-label">
                Sample Text
                <input
                  className="modal-input"
                  value={editFieldDraft.sampleText}
                  onChange={(e) =>
                    handleEditDraftChange("sampleText", e.target.value)
                  }
                />
              </label>

              <label className="modal-label">
                Font Size (px)
                <input
                  type="number"
                  className="modal-input"
                  value={editFieldDraft.fontSize}
                  onChange={(e) =>
                    handleEditDraftChange("fontSize", e.target.value)
                  }
                />
              </label>

              <label className="modal-label">
                Font Color
                <input
                  className="modal-input"
                  value={editFieldDraft.fontColor}
                  onChange={(e) =>
                    handleEditDraftChange("fontColor", e.target.value)
                  }
                  placeholder="#111827"
                />
              </label>

              <label className="modal-label">
                Font Weight
                <input
                  className="modal-input"
                  value={editFieldDraft.fontWeight}
                  onChange={(e) =>
                    handleEditDraftChange("fontWeight", e.target.value)
                  }
                  placeholder="300, 400, 500, 600..."
                />
              </label>

              <label className="modal-label">
                Font Family
                <select
                  className="modal-select"
                  value={editFieldDraft.fontFamily}
                  onChange={(e) =>
                    handleEditDraftChange("fontFamily", e.target.value)
                  }
                >
                  <option value="Arial">Arial</option>
                  <option value="Caladea">Caladea</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Times">Times Roman</option>
                  <option value="Courier New">Courier New</option>
                  <option value="Verdana">Verdana</option>
                </select>
              </label>

              <label className="modal-label">
                Text Align
                <select
                  className="modal-select"
                  value={editFieldDraft.textAlign}
                  onChange={(e) =>
                    handleEditDraftChange("textAlign", e.target.value)
                  }
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </label>

              <label className="modal-label">
                X Position (0–1)
                <input
                  type="number"
                  step="0.01"
                  className="modal-input"
                  value={editFieldDraft.x}
                  onChange={(e) => handleEditDraftChange("x", e.target.value)}
                />
              </label>

              <label className="modal-label">
                Y Position (0–1)
                <input
                  type="number"
                  step="0.01"
                  className="modal-input"
                  value={editFieldDraft.y}
                  onChange={(e) => handleEditDraftChange("y", e.target.value)}
                />
              </label>

              <label className="modal-label">
                Width (0–1)
                <input
                  type="number"
                  step="0.01"
                  className="modal-input"
                  value={editFieldDraft.width}
                  onChange={(e) =>
                    handleEditDraftChange("width", e.target.value)
                  }
                />
              </label>

              <label className="modal-label">
                Height (0–1)
                <input
                  type="number"
                  step="0.01"
                  className="modal-input"
                  value={editFieldDraft.height}
                  onChange={(e) =>
                    handleEditDraftChange("height", e.target.value)
                  }
                />
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-pill btn-light"
                  onClick={closeEditFieldModal}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-pill btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}