import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/backend/app.js";

describe("createApp", () => {
  it("serves the browser preview UI at the root route", async () => {
    const app = createApp();
    const response = await request(app).get("/");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/text\/html/);
    expect(response.text).toContain("Mode 1 · File Input");
    expect(response.text).toContain("Mode 2 · Code Input");
    expect(response.text).toContain("Analyze and create Figma layout");
    expect(response.text).toContain("Browser preview only");
  });

  it("exposes a lightweight health endpoint", async () => {
    const app = createApp();
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("does not expose the old backend conversion route", async () => {
    const app = createApp();
    const response = await request(app).post("/v1/convert").send({});

    expect(response.status).toBe(404);
  });
});
