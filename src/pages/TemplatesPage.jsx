// src/pages/TemplatesPage.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import toast from 'react-hot-toast';
import { API_BASE_URL } from "../config";

export default function TemplatesPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 5;

  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  async function fetchTemplates(pageToLoad = 1) {
    try {
      setLoading(true);
      const res = await client.get('/templates', {
        params: { page: pageToLoad, limit },
      });
      setTemplates(res.data.items);
      setTotal(res.data.total);
      setPage(res.data.page);
    } catch (err) {
      if (err.response?.status === 401) {
        navigate('/login', { replace: true });
      } else {
        toast.error(err.response?.data?.message || 'Failed to load templates');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTemplates(1);
  }, []);

  const totalPages = Math.ceil(total / limit) || 1;

  async function handleUpload(e) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Template name is required');
      return;
    }
    if (!file) {
      toast.error('Template image is required');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Only image files (JPG/PNG) are allowed');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10 MB');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('file', file);

      await client.post('/templates', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success('Template uploaded successfully');
      setName('');
      setFile(null);
      // Re-fetch page 1 as per your backend behavior
      fetchTemplates(1);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to upload template';
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e) {
    const f = e.target.files?.[0];
    setFile(f || null);
  }

  function handleClickTemplate(template) {
    // Navigate to templatedetail/:id
    navigate(`/templatedetail/${template._id}`);
  }

  function handleAddFields(template) {
    navigate(`/template/${template._id}/edit`);
  }

  async function handleDelete(template) {
    const confirm = window.confirm(
      `Are you sure you want to delete "${template.name}"? This action cannot be undone.`
    );
    if (!confirm) return;

    try {
      await client.delete(`/templates/${template._id}`);
      toast.success('Template deleted');
      fetchTemplates(page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete template');
    }
  }

  // Rename flow: for now a simple prompt; later we can replace with a custom modal UI.
  async function handleRename(template) {
    const newName = window.prompt('Enter new template name', template.name);
    if (!newName || newName.trim() === template.name) return;

    try {
      await client.put(`/templates/${template._id}`, { name: newName.trim() });
      toast.success('Template renamed');
      fetchTemplates(page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to rename template');
    }
  }

  function goToPage(p) {
    if (p < 1 || p > totalPages) return;
    fetchTemplates(p);
  }

  return (
    <div className="templates-page">
      {/* top bar */}
      <header className="templates-header">
        <div className="logo">masai.</div>
        <h1>Templates</h1>
        <div className="user-avatar">H</div>
      </header>

      {/* upload bar */}
      <section className="templates-upload">
        <form onSubmit={handleUpload} className="upload-form">
          <label className="upload-label">
            Template Name
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter template name"
            />
          </label>
          <input type="file" onChange={handleFileChange} />
          <button type="submit" disabled={uploading}>
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </form>
      </section>

      {/* templates table */}
      <section className="templates-table-section">
        {loading ? (
          <p>Loading templates...</p>
        ) : templates.length === 0 ? (
          <p>No templates yet</p>
        ) : (
          <table className="templates-table">
            <thead>
              <tr>
                <th>SL ID</th>
                <th>Name</th>
                <th>Template</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t, index) => (
                <tr key={t._id}>
                  <td>{(page - 1) * limit + (index + 1)}</td>
                  <td>
                    <button
                      className="link-button"
                      type="button"
                      onClick={() => handleClickTemplate(t)}
                    >
                      {t.name}
                    </button>
                  </td>
                  <td>
                    <img
                      src={`${API_BASE_URL}${t.imagePath}`}
                      alt={t.name}
                      className="template-thumb"
                    />
                  </td>
                  <td>
                    <div className="actions">
                      <button type="button" onClick={() => handleRename(t)}>
                        Rename
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => handleDelete(t)}
                      >
                        Delete
                      </button>
                      <button type="button" onClick={() => handleAddFields(t)}>
                        Add Fields
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <button onClick={() => goToPage(page - 1)} disabled={page === 1}>
              &lt;
            </button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i + 1}
                onClick={() => goToPage(i + 1)}
                className={page === i + 1 ? 'active' : ''}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page === totalPages}
            >
              &gt;
            </button>
          </div>
        )}
      </section>

      <footer className="templates-footer">
        <span>© 2025 Masai School. All Rights Reserved.</span>
        {/* you can add social icons here */}
      </footer>
    </div>
  );
}
