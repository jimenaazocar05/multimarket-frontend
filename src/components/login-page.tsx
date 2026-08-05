import { useState, useEffect, useId } from "react";
import { Eye, EyeOff, ShoppingCart, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";

/* ─── micro-animation keyframes injected once ─────────────────────────────── */
const STYLES = `
  @keyframes mm-fade-up {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes mm-float {
    0%, 100% { transform: translateY(0px) rotate(-2deg); }
    50%       { transform: translateY(-10px) rotate(2deg); }
  }
  @keyframes mm-pulse-ring {
    0%   { box-shadow: 0 0 0 0 oklch(0.55 0.23 258 / 0.35); }
    70%  { box-shadow: 0 0 0 14px oklch(0.55 0.23 258 / 0); }
    100% { box-shadow: 0 0 0 0 oklch(0.55 0.23 258 / 0); }
  }
  .mm-fade-up        { animation: mm-fade-up 0.55s cubic-bezier(.22,1,.36,1) both; }
  .mm-delay-1        { animation-delay: 0.08s; }
  .mm-delay-2        { animation-delay: 0.16s; }
  .mm-delay-3        { animation-delay: 0.24s; }
  .mm-delay-4        { animation-delay: 0.32s; }
  .mm-delay-5        { animation-delay: 0.40s; }
  .mm-float          { animation: mm-float 4s ease-in-out infinite; }
  .mm-pulse          { animation: mm-pulse-ring 2s infinite; }
`;

export function LoginPage() {
  const { login } = useAuth();
  const usernameId = useId();
  const passwordId = useId();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /* inject keyframes once */
  useEffect(() => {
    if (document.getElementById("mm-login-styles")) return;
    const el = document.createElement("style");
    el.id = "mm-login-styles";
    el.textContent = STYLES;
    document.head.appendChild(el);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setError(null);
    setLoading(true);
    const result = await login(username, password);
    setLoading(false);
    if (!result.ok) setError(result.error ?? "Error de autenticación");
  };

  return (
    <div
      className="grid min-h-[100svh] grid-cols-1 lg:grid-cols-2"
      style={{
        background: "var(--background)",
        fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* ── LEFT PANEL ─────────────────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          backgroundColor: "#007BFF", /* Bright blue to match the banner */
        }}
        className="hidden lg:flex items-center justify-center"
      >
        <img
          src="/Banner Multimarket.png"
          alt="Multimarket Banner"
          style={{
            width: "65%", /* Reduced size */
            maxWidth: "500px",
            height: "auto",
            objectFit: "contain",
          }}
        />
      </div>

      {/* ── RIGHT PANEL (form) ─────────────────────────────────────────────── */}
      <div
        className="w-full flex justify-center items-start pt-[12vh] pb-8 px-6 lg:items-center lg:p-8"
      >
        <div style={{ width: "100%", maxWidth: "400px" }}>
          {/* mobile logo */}
          <div
            className="mm-fade-up flex lg:hidden items-center gap-2.5 mb-8"
          >
            <img
              src="/logo_multimarket.png"
              alt="Multimarket Logo"
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "8px",
                objectFit: "cover",
              }}
            />
            <div>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: "1rem",
                  letterSpacing: "-0.02em",
                  color: "var(--foreground)",
                }}
              >
                MULTIMARKET
              </div>
              <div
                style={{
                  fontSize: "0.65rem",
                  color: "var(--muted-foreground)",
                  fontWeight: 500,
                }}
              >
                Sistema de ventas
              </div>
            </div>
          </div>

          {/* heading */}
          <div className="mm-fade-up mm-delay-1" style={{ marginBottom: "2rem" }}>
            <h1
              style={{
                fontSize: "1.75rem",
                fontWeight: 800,
                letterSpacing: "-0.025em",
                color: "var(--foreground)",
                marginBottom: "0.4rem",
              }}
            >
              Iniciar sesión
            </h1>
          </div>

          {/* form */}
          <form
            id="login-form"
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}
          >
            {/* username */}
            <div className="mm-fade-up mm-delay-2">
              <label
                htmlFor={usernameId}
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--foreground)",
                  marginBottom: "0.4rem",
                  letterSpacing: "0.01em",
                }}
              >
                Usuario
              </label>
              <input
                id={usernameId}
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError(null);
                }}
                placeholder="tu.usuario"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "0.65rem 0.875rem",
                  borderRadius: "var(--radius-md, 0.5rem)",
                  border: error
                    ? "1.5px solid var(--destructive)"
                    : "1.5px solid var(--border)",
                  background: "var(--card)",
                  color: "var(--foreground)",
                  fontSize: "0.9rem",
                  outline: "none",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--primary)";
                  e.currentTarget.style.boxShadow =
                    "0 0 0 3px oklch(0.55 0.23 258 / 0.12)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = error
                    ? "var(--destructive)"
                    : "var(--border)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            {/* password */}
            <div className="mm-fade-up mm-delay-3">
              <label
                htmlFor={passwordId}
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--foreground)",
                  marginBottom: "0.4rem",
                  letterSpacing: "0.01em",
                }}
              >
                Contraseña
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id={passwordId}
                  type={showPwd ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="••••••••"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "0.65rem 2.5rem 0.65rem 0.875rem",
                    borderRadius: "var(--radius-md, 0.5rem)",
                    border: error
                      ? "1.5px solid var(--destructive)"
                      : "1.5px solid var(--border)",
                    background: "var(--card)",
                    color: "var(--foreground)",
                    fontSize: "0.9rem",
                    outline: "none",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--primary)";
                    e.currentTarget.style.boxShadow =
                      "0 0 0 3px oklch(0.55 0.23 258 / 0.12)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = error
                      ? "var(--destructive)"
                      : "var(--border)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
                <button
                  type="button"
                  aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                  onClick={() => setShowPwd((v) => !v)}
                  style={{
                    position: "absolute",
                    right: "0.75rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--muted-foreground)",
                    display: "flex",
                    padding: "0",
                  }}
                >
                  {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* error message */}
            {error && (
              <div
                role="alert"
                className="mm-fade-up"
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.5rem",
                  padding: "0.65rem 0.875rem",
                  borderRadius: "var(--radius-md, 0.5rem)",
                  background: "oklch(0.60 0.23 27 / 0.08)",
                  border: "1px solid oklch(0.60 0.23 27 / 0.25)",
                  color: "var(--destructive)",
                  fontSize: "0.82rem",
                  lineHeight: 1.5,
                }}
              >
                <AlertCircle size={15} style={{ marginTop: "1px", flexShrink: 0 }} />
                {error}
              </div>
            )}

            {/* submit */}
            <button
              type="submit"
              id="login-submit-btn"
              disabled={loading || !username.trim() || !password}
              className="mm-fade-up mm-delay-4"
              style={{
                width: "100%",
                padding: "0.72rem 1rem",
                borderRadius: "var(--radius-md, 0.5rem)",
                border: "none",
                background:
                  loading || !username.trim() || !password
                    ? "var(--muted)"
                    : "linear-gradient(135deg, oklch(0.55 0.23 258), oklch(0.48 0.20 258))",
                color:
                  loading || !username.trim() || !password
                    ? "var(--muted-foreground)"
                    : "white",
                fontSize: "0.9rem",
                fontWeight: 700,
                letterSpacing: "0.01em",
                cursor:
                  loading || !username.trim() || !password
                    ? "not-allowed"
                    : "pointer",
                transition: "opacity 0.15s, transform 0.1s, box-shadow 0.15s",
                boxShadow:
                  loading || !username.trim() || !password
                    ? "none"
                    : "0 4px 14px oklch(0.55 0.23 258 / 0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
              }}
              onMouseEnter={(e) => {
                if (!loading && username.trim() && password) {
                  e.currentTarget.style.opacity = "0.9";
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow =
                    "0 6px 20px oklch(0.55 0.23 258 / 0.45)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow =
                  loading || !username.trim() || !password
                    ? "none"
                    : "0 4px 14px oklch(0.55 0.23 258 / 0.35)";
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                  Verificando…
                </>
              ) : (
                "Ingresar al sistema"
              )}
            </button>
          </form>

          {/* footer */}
          <p
            className="mm-fade-up mm-delay-5"
            style={{
              marginTop: "2rem",
              textAlign: "center",
              fontSize: "0.75rem",
              color: "var(--muted-foreground)",
            }}
          >
            ¿Problemas para ingresar? Contacta a tu administrador.
          </p>
        </div>
      </div>

      {/* spin keyframe for loader */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
