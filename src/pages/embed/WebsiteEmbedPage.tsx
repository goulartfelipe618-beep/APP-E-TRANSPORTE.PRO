import { useEffect, useRef } from "react";
import { ActivePageProvider } from "@/contexts/ActivePageContext";
import WebsitePage from "@/pages/dashboard/WebsitePage";

function EmbedHeightReporter() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.classList.add("etp-embed-website");
    document.body.classList.add("etp-embed-website");
    return () => {
      document.documentElement.classList.remove("etp-embed-website");
      document.body.classList.remove("etp-embed-website");
    };
  }, []);

  useEffect(() => {
    const post = () => {
      const el = rootRef.current;
      if (!el || typeof window.parent === "undefined") return;
      const height = Math.ceil(
        Math.max(el.scrollHeight, el.getBoundingClientRect().height) + 32,
      );
      window.parent.postMessage({ type: "etp-website-embed-height", height }, window.location.origin);
    };
    post();
    const ro = new ResizeObserver(() => post());
    if (rootRef.current) ro.observe(rootRef.current);
    window.addEventListener("resize", post);
    const t = window.setInterval(post, 800);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", post);
      window.clearInterval(t);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="etp-website-embed-root w-full max-w-none min-h-0 bg-background text-foreground px-2 py-3 sm:px-4 sm:py-4"
    >
      <WebsitePage variant="embed" />
    </div>
  );
}

/** Página pública embutível em WordPress (iframe). */
export default function WebsiteEmbedPage() {
  return (
    <ActivePageProvider defaultPage="website" storageKey="etp_embed_website">
      <EmbedHeightReporter />
    </ActivePageProvider>
  );
}
