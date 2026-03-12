import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, Key, RefreshCw, LogIn } from "lucide-react";
import { supabase } from "@/lib/supabase";
import luxuryCar from "@/assets/luxury-car.jpg";

function generateCaptcha(length = 6): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const refreshCaptcha = useCallback(() => {
    setCaptcha(generateCaptcha());
    setCaptchaInput("");
  }, []);

  useEffect(() => {
    refreshCaptcha();
  }, [refreshCaptcha]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (captchaInput !== captcha) {
      setError("Código de verificação incorreto.");
      refreshCaptcha();
      return;
    }

    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      refreshCaptcha();
      return;
    }

    navigate("/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--login-bg))] p-4">
      <div className="w-full max-w-md">
        <div className="overflow-hidden rounded-2xl bg-[hsl(var(--login-card))] shadow-2xl">
          {/* Car Image */}
          <div className="overflow-hidden rounded-t-2xl">
            <img
              src={luxuryCar}
              alt="Luxury car"
              className="h-52 w-full object-cover"
            />
          </div>

          {/* Form */}
          <div className="px-8 pb-8 pt-6">
            <h1 className="mb-6 text-center text-xl font-bold text-foreground">
              Faça seu Login
            </h1>

            <form onSubmit={handleLogin} className="space-y-4">
              {/* Email */}
              <div className="flex items-center gap-3 rounded-lg border border-[hsl(var(--login-input-border))] bg-[hsl(var(--login-input))] px-4 py-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>

              {/* Password */}
              <div className="flex items-center gap-3 rounded-lg border border-[hsl(var(--login-input-border))] bg-[hsl(var(--login-input))] px-4 py-3">
                <Lock className="h-5 w-5 text-muted-foreground" />
                <input
                  type="password"
                  placeholder="Senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>

              {/* Captcha Display */}
              <div className="flex items-center gap-3">
                <Key className="h-5 w-5 text-muted-foreground" />
                <div className="rounded-lg bg-[hsl(var(--captcha-bg))] px-4 py-2 font-mono text-lg tracking-widest text-foreground line-through decoration-muted-foreground/40">
                  {captcha}
                </div>
                <button
                  type="button"
                  onClick={refreshCaptcha}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <RefreshCw className="h-5 w-5" />
                </button>
              </div>

              {/* Captcha Input */}
              <div className="flex items-center gap-3 rounded-lg border border-[hsl(var(--login-input-border))] bg-[hsl(var(--login-input))] px-4 py-3">
                <Key className="h-5 w-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Digite o código acima"
                  value={captchaInput}
                  onChange={(e) => setCaptchaInput(e.target.value)}
                  required
                  className="w-full bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>

              {/* Error */}
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[hsl(var(--login-btn))] py-3 font-semibold text-[hsl(var(--login-btn-foreground))] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <LogIn className="h-5 w-5" />
                {loading ? "Entrando..." : "Iniciar Sessão"}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          © 2026 — Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
};

export default Login;
