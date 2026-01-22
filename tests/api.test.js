import { describe, it, expect } from "vitest";

const API_URL = process.env.API_URL || "https://html2pdfapi.com";

describe("API integration tests", () => {
  it("should render an image from URL", async () => {
    const response = await fetch(`${API_URL}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com",
        type: "image",
      }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/");
    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it("should render a PDF from URL", async () => {
    const response = await fetch(`${API_URL}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com",
        type: "pdf",
      }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/pdf");
    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it("should render HTML content directly", async () => {
    const response = await fetch(`${API_URL}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        html: "<h1>Hello World</h1><p>Test content</p>",
        type: "image",
      }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/");
  });

  it("should return 400 for missing url and html", async () => {
    const response = await fetch(`${API_URL}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "image",
      }),
    });
    expect(response.status).toBe(400);
  });

  it("should return 400 for invalid type", async () => {
    const response = await fetch(`${API_URL}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com",
        type: "invalid",
      }),
    });
    expect(response.status).toBe(400);
  });

  it("should support GET with config query parameter", async () => {
    const config = encodeURIComponent(JSON.stringify({
      url: "https://example.com",
      type: "image",
    }));
    const response = await fetch(`${API_URL}/render?config=${config}`);
    expect(response.status).toBe(200);
  });

  it("should return 400 for malformed JSON in GET config", async () => {
    const response = await fetch(`${API_URL}/render?config=not-json`);
    expect(response.status).toBe(400);
  });

  it("should support full page screenshot", async () => {
    const response = await fetch(`${API_URL}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com",
        type: "image",
        render: { fullPage: true },
      }),
    });
    expect(response.status).toBe(200);
  });

  it("should support webp output format", async () => {
    const response = await fetch(`${API_URL}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com",
        type: "image",
        image: { type: "webp", quality: 80 },
      }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/webp");
  });

  it("should not expose internal error details", async () => {
    const response = await fetch(`${API_URL}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://this-domain-does-not-exist-xyz123.invalid",
        type: "image",
      }),
    });
    // Should be an error but not leak internals
    expect(response.status).toBeGreaterThanOrEqual(400);
    const body = await response.json();
    expect(body.details).toBeUndefined();
    expect(body.stack).toBeUndefined();
  });
});

describe("API performance tests", () => {
  it("should respond within 15 seconds for a simple page", async () => {
    const start = Date.now();
    const response = await fetch(`${API_URL}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com",
        type: "image",
      }),
    });
    const elapsed = Date.now() - start;
    expect(response.status).toBe(200);
    expect(elapsed).toBeLessThan(15000);
  });

  it("should handle concurrent requests", async () => {
    const requests = Array.from({ length: 3 }, () =>
      fetch(`${API_URL}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: "<h1>Concurrent test</h1>",
          type: "image",
        }),
      })
    );

    const responses = await Promise.all(requests);
    for (const response of responses) {
      expect(response.status).toBe(200);
    }
  });

  it("should return content-disposition header with filename", async () => {
    const response = await fetch(`${API_URL}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com",
        type: "pdf",
      }),
    });
    expect(response.status).toBe(200);
    const disposition = response.headers.get("content-disposition");
    expect(disposition).toContain("attachment");
    expect(disposition).toContain("filename=");
  });
});
