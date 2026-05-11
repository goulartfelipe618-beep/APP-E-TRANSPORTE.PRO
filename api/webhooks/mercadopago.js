import { createApp } from "../../server/app.mjs";

const app = createApp();

export default function handler(req, res) {
  const queryIndex = req.url.indexOf("?");
  const query = queryIndex >= 0 ? req.url.slice(queryIndex) : "";
  req.url = `/api/webhooks/mercadopago${query}`;
  return app(req, res);
}
