import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

/** Lê env de arquivo (.env) e de process.env (Vercel injeta no build). Aceita nomes alternativos comuns. */
function supabaseEnvFromProcess(fileEnv: Record<string, string>) {
  const url =
    fileEnv.VITE_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL;
  const key =
    fileEnv.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;
  const projectId =
    fileEnv.VITE_SUPABASE_PROJECT_ID ||
    process.env.VITE_SUPABASE_PROJECT_ID ||
    process.env.SUPABASE_PROJECT_REF;
  return { url: url ?? "", key: key ?? "", projectId: projectId ?? "" };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), "");
  const { url, key, projectId } = supabaseEnvFromProcess(fileEnv);

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      rollupOptions: {
        output: {
          // Apenas libs pesadas e bem isoladas — evita chunks circulares (vendor ↔ react).
          manualChunks(id) {
            const normalized = id.replace(/\\/g, "/");
            if (!normalized.includes("node_modules/")) return;
            const rest = normalized.split("node_modules/")[1];
            if (!rest) return;
            const segments = rest.split("/");
            const pkg =
              segments[0]?.startsWith("@") && segments[1]
                ? `${segments[0]}/${segments[1]}`
                : (segments[0] ?? "");
            if (pkg === "recharts") return "charts";
            if (pkg === "jspdf" || pkg === "html2canvas") return "pdf";
            if (pkg === "leaflet" || pkg === "react-leaflet") return "maps";
            if (pkg === "lucide-react") return "icons";
          },
        },
      },
      chunkSizeWarningLimit: 900,
    },
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(url),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(key),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(projectId),
    },
  };
});
