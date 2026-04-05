import { useSyncExternalStore } from "react";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

function subscribeToHtmlDark(callback: () => void) {
  const el = document.documentElement;
  const obs = new MutationObserver(() => callback());
  obs.observe(el, { attributes: true, attributeFilter: ["class"] });
  return () => obs.disconnect();
}

function getHtmlIsDarkSnapshot() {
  return document.documentElement.classList.contains("dark");
}

function getServerSnapshot() {
  return false;
}

function useHtmlDarkTheme(): "light" | "dark" {
  const dark = useSyncExternalStore(subscribeToHtmlDark, getHtmlIsDarkSnapshot, getServerSnapshot);
  return dark ? "dark" : "light";
}

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useHtmlDarkTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
