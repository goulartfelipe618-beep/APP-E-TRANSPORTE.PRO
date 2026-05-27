import { useEffect, useRef } from "react";
import { ActivePageProvider } from "@/contexts/ActivePageContext";
import WebsitePage from "@/pages/dashboard/WebsitePage";

function EmbedHeightReporter() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const post = () => {
      const el = rootRef.current;
      if (!el || typeof window.parent === "undefined") return;
      const height = Math.ceil(el.getBoundingClientRect().height + 24);
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
    <div ref={rootRef} className="min-h-[720px] w-full max-w-[1400px] mx-auto bg-background text-foreground px-3 py-4 sm:px-6 sm:py-6">
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
