import { createApp } from "./app.js";
import { resolvePort } from "./config.js";

const port = resolvePort(process.env.PORT);
const app = createApp();

app.listen(port, () => {
  console.log(`Webgma backend listening on http://localhost:${port}`);
});
