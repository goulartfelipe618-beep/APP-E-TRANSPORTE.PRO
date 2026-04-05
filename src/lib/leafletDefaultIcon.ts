import L from "leaflet";

/** Leaflet 1.9.x — ícones via CDN; L.icon explícito evita createIcon undefined no bundle (Vite + produção). */
const CDN = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images";

export const leafletDefaultMarkerIcon = L.icon({
  iconUrl: `${CDN}/marker-icon.png`,
  iconRetinaUrl: `${CDN}/marker-icon-2x.png`,
  shadowUrl: `${CDN}/marker-shadow.png`,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: `${CDN}/marker-icon-2x.png`,
  iconUrl: `${CDN}/marker-icon.png`,
  shadowUrl: `${CDN}/marker-shadow.png`,
});
