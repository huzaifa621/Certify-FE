// src/pages/LoginPage.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import toast from "react-hot-toast";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isButtonDisabled = !email || !password || submitting;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.endsWith("@masaischool.com")) {
      toast.error("Please use your @masaischool.com email");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    try {
      setSubmitting(true);
      await client.post("/auth/login", { email, password });
      toast.success("Logged in successfully");
      navigate("/", { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || "Invalid email or password";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  // NOTE: The JSX layout is simplified here; you can refine CSS to match your exact UI.
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f3f4f6]">
      <div className="login-card">
        <div className="login-left">
          {/* Placeholder illustration section */}
          <div className="illustration">Certify Platform</div>
        </div>

        <div className="login-right">
          <div className="login-logo">Masai</div>
          <h1 className="login-title">Welcome Back</h1>
          <p className="login-subtitle">
            
          </p>

          <form onSubmit={handleSubmit} className="login-form">
            <label className="login-label">
              Email
              <div className="login-input-wrapper">
                {/* left icon slot */}
                <span className="login-input-icon-left">📧</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@masaischool.com"
                  className="login-input"
                />
                {/* right valid tick */}
                {email.endsWith("@masaischool.com") && (
                  <span className="login-input-icon-right">✔️</span>
                )}
              </div>
            </label>

            <label className="login-label">
              Password
              <div className="login-input-wrapper">
                <span className="login-input-icon-left">🔒</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                  className="login-input"
                />
                {password.length >= 8 && (
                  <span className="login-input-icon-right">✔️</span>
                )}
              </div>
            </label>

            <button
              type="submit"
              disabled={isButtonDisabled}
              className={`login-button ${isButtonDisabled ? "disabled" : ""}`}
            >
              {submitting ? "Logging in..." : "Login"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
