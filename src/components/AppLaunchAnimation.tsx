import { useEffect, useState } from "react";
import "./AppLaunchAnimation.css";

const SEEN_KEY = "etp_launch_anim_v1";

function skipPath(path: string): boolean {
  return (
    path.startsWith("/rastreio") ||
    path.startsWith("/embed") ||
    path.startsWith("/motorista-frota-doc") ||
    path.startsWith("/verificar-motorista")
  );
}

/** Abertura do app: uma vez por sessão, em celular, tablet e tela grande. */
export default function AppLaunchAnimation() {
  const [phase, setPhase] = useState<"play" | "out" | "gone">("play");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (skipPath(window.location.pathname || "")) {
      setPhase("gone");
      return;
    }
    try {
      if (sessionStorage.getItem(SEEN_KEY) === "1") {
        setPhase("gone");
        return;
      }
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* sessão indisponível: a animação ainda passa nesta abertura */
    }

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hold = reduce ? 450 : 2600;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const leave = window.setTimeout(() => setPhase("out"), hold);
    const done = window.setTimeout(() => setPhase("gone"), hold + 480);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(leave);
      window.clearTimeout(done);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      className={phase === "out" ? "launch-screen is-out" : "launch-screen"}
      role="dialog"
      aria-modal="true"
      aria-label="Abrindo o E-TRANSPORTE"
    >
      <div className="launch-scene">
        <p className="launch-kicker">E-TRANSPORTE.PRO</p>
        <div className="launch-road" aria-hidden="true">
          <span className="launch-line" />
          <span className="launch-car">
            <svg viewBox="0 0 64 28" width="64" height="28">
              <path
                d="M6 18h52M10 18l4-9h28l8 9"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="20" cy="18" r="3.2" fill="currentColor" />
              <circle cx="46" cy="18" r="3.2" fill="currentColor" />
            </svg>
          </span>
        </div>
        <h1>A operação está abrindo</h1>
      </div>
    </div>
  );
}
