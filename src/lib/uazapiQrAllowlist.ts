export const UAZAPI_QR_ALLOW_EMAIL = "matheusbrumds@gmail.com";

export function isUazapiQrAllowlisted(email: string | null | undefined): boolean {
  return (email || "").trim().toLowerCase() === UAZAPI_QR_ALLOW_EMAIL;
}
