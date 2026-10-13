import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Casca nativa do portal da frota (o mesmo React do site).
 * O browser em e-transporte.pro não usa este ficheiro.
 * Deep links: https://e-transporte.pro/frota e /frota/acesso/:token
 * Esquema de teste (antes das lojas validarem o domínio): etransporte://frota/acesso/:token
 */
const config: CapacitorConfig = {
  appId: "pro.etransporte.frota",
  appName: "E-TRANSPORTE Frota",
  webDir: "dist",
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SystemBars: {
      /* Injeta --safe-area-inset-* . No WebView novo o modo native não reserva a barra. */
      insetsHandling: "css",
      initialViewportFitValueHint: "cover",
    },
  },
  server: {
    androidScheme: "https",
    hostname: "localhost",
  },
  ios: {
    /* A margem fica no CSS do app. O site não usa esta casca. */
    contentInset: "never",
  },
};

export default config;
