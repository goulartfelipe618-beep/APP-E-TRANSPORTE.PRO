import { createApp } from "./app.mjs";
import { logger } from "./logger.mjs";

const port = Number(process.env.PORT || 8787);
const app = createApp();

app.listen(port, () => {
  logger.info(`API a escutar em http://127.0.0.1:${port} (health: /health, echo: POST /v1/echo + Bearer JWT)`);
});
