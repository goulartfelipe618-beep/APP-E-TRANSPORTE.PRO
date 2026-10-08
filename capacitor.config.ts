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
  server: {
    androidScheme: "https",
    hostname: "localhost",
  },
  ios: {
    contentInset: "automatic",
  },
};

export default config;
