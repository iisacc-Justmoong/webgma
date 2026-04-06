import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/backend/app.js";

describe("createApp", () => {
  it("returns merged HTML and a design plan", async () => {
    const app = createApp();
    const response = await request(app).post("/v1/convert").send({
      html: {
        content: '<section class="hero"><h1>Hello</h1></section>',
        mode: "code"
      },
      css: {
        content:
          ".hero { display: flex; padding: 32px; background: #0f172a; } h1 { font-size: 28px; color: #ffffff; }",
        mode: "code"
      }
    });

    expect(response.status).toBe(200);
    expect(response.body.mergedHtml).toMatch(/padding:\s*32px/i);
    expect(response.body.designPlan.root.children).toHaveLength(1);
    expect(response.body.warnings[0]).toMatch(/Current scaffold maps inline styles/i);
  });

  it("rejects invalid requests", async () => {
    const app = createApp();
    const response = await request(app).post("/v1/convert").send({
      html: {
        content: "",
        mode: "code"
      },
      css: {
        content: "body { color: red; }",
        mode: "code"
      }
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/HTML content is required/i);
  });
});
