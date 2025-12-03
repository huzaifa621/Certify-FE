// src/pages/VerifyCertificatePage.jsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import client from "../api/client";
import { API_BASE_URL } from "../config";

export default function VerifyCertificatePage() {
  const { certId } = useParams();

  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    async function fetchCertificate() {
      try {
        setLoading(true);
        const res = await client.get(`/public/certificates/${certId}`);
        setValid(res.data.valid);
        setData(res.data);
      } catch (err) {
        setValid(false);
      } finally {
        setLoading(false);
      }
    }

    fetchCertificate();
  }, [certId]);

  if (loading) {
    return (
      <div className="verify-page">
        <p className="verify-loading">Verifying certificate...</p>
      </div>
    );
  }

  if (!valid || !data?.certificate) {
    return (
      <div className="verify-page">
        <div className="verify-card invalid">
          <h2>❌ Invalid Certificate</h2>
          <p>
            This certificate could not be verified. It may be deleted,
            incorrect, or tampered.
          </p>
        </div>
      </div>
    );
  }

  const cert = data.certificate;
  const batch = data.batch;
  const template = data.template;

  const certificateId = cert.certificateId || cert.id; // prefer new ID
  const batchId = batch?.batchCode || batch?.id;
  const templateId = template?.templateCode || template?.id;

  return (
    <div className="verify-page">
      <div className="verify-card">
        <div className="verify-badge">✔ Certificate Verified</div>

        <h1 className="verify-name">
          {cert.name || cert.data?.Name || "Unnamed"}
        </h1>
        <p className="verify-email">{cert.email}</p>

        <div className="verify-meta">
          <div>
            <strong>Recipient:</strong> {cert.name || cert.email}
          </div>
          <div>
            <strong>Email:</strong> {cert.email}
          </div>

          {/* NEW: show stable IDs */}
          <div>
            <strong>Certificate ID:</strong> {certificateId}
          </div>
          {batchId && (
            <div>
              <strong>Batch ID:</strong> {batchId}
            </div>
          )}
          {templateId && (
            <div>
              <strong>Template ID:</strong> {templateId}
            </div>
          )}

          <div>
            <strong>Batch:</strong> {batch?.name}
          </div>
          <div>
            <strong>Template:</strong> {template?.name || "N/A"}
          </div>
          <div>
            <strong>Issued On:</strong>{" "}
            {batch?.createdAt
              ? new Date(batch.createdAt).toLocaleDateString()
              : "-"}
          </div>
        </div>

        <div className="verify-image-wrapper">
          <img
            src={`${API_BASE_URL}${cert.filePath}`}
            alt="Verified Certificate"
            className="verify-image"
          />
        </div>
      </div>
    </div>
  );
}
