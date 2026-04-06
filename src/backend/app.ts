import express from "express";
import { loadPluginUiPreviewHtml } from "./views/plugin-ui-preview.js";

export function createApp() {
  const app = express();

  app.get("/", (_request, response) => {
    response.type("html").send(loadPluginUiPreviewHtml());
  });

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  return app;
}
