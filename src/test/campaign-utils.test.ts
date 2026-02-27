import { describe, it, expect } from "vitest";
import { detectUrlInContent, countUrlsInContent, detectManualCtaButton, generateCtaButtonHtml } from "@/lib/campaign-utils";

describe("detectUrlInContent", () => {
  it("detects a simple URL", () => {
    expect(detectUrlInContent("Visite https://example.com")).toBe(true);
  });

  it("detects URL with parameters", () => {
    expect(detectUrlInContent("Link: https://example.com/page?utm_source=email&ref=123")).toBe(true);
  });

  it("detects shortened URL", () => {
    expect(detectUrlInContent("Veja: https://bit.ly/abc123")).toBe(true);
  });

  it("detects URL inside HTML", () => {
    expect(detectUrlInContent('<a href="https://example.com">click</a>')).toBe(true);
  });

  it("returns false for content without URL", () => {
    expect(detectUrlInContent("Olá João, tudo bem?")).toBe(false);
  });

  it("returns false for empty content", () => {
    expect(detectUrlInContent("")).toBe(false);
  });

  it("detects duplicate URLs", () => {
    expect(detectUrlInContent("https://a.com e https://a.com")).toBe(true);
  });
});

describe("countUrlsInContent", () => {
  it("counts unique URLs", () => {
    expect(countUrlsInContent("https://a.com and https://b.com")).toBe(2);
  });

  it("deduplicates same URL", () => {
    expect(countUrlsInContent("https://a.com and https://a.com")).toBe(1);
  });

  it("returns 0 for no URLs", () => {
    expect(countUrlsInContent("no links here")).toBe(0);
  });
});

describe("detectManualCtaButton", () => {
  it("detects a styled button link", () => {
    const html = '<a href="https://x.com" style="display:inline-block;background-color:#333;padding:10px 20px;border-radius:6px;">Click</a>';
    expect(detectManualCtaButton(html)).toBe(true);
  });

  it("returns false for plain link", () => {
    expect(detectManualCtaButton('<a href="https://x.com">Click</a>')).toBe(false);
  });
});

describe("generateCtaButtonHtml", () => {
  it("generates valid HTML with config", () => {
    const html = generateCtaButtonHtml({
      text: "Visit",
      backgroundColor: "#3b82f6",
      fontColor: "#ffffff",
      url: "https://example.com",
    });
    expect(html).toContain("https://example.com");
    expect(html).toContain("Visit");
    expect(html).toContain("#3b82f6");
  });
});
