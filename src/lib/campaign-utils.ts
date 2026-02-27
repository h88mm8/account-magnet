/**
 * Centralized campaign utilities for CTA generation and URL detection.
 */

// ─── URL Detection ────────────────────────────────────────────────
/**
 * Detects if HTML/text content contains at least one URL.
 * Handles simple URLs, URLs with params, shortened URLs, and duplicates.
 */
export function detectUrlInContent(content: string): boolean {
  if (!content) return false;
  const regex = /https?:\/\/[^\s<>"')\]]+/i;
  // Check raw content first (catches href="..."), then stripped
  return regex.test(content) || regex.test(content.replace(/<[^>]+>/g, " "));
}

/**
 * Counts unique URLs found in content.
 */
export function countUrlsInContent(content: string): number {
  if (!content) return 0;
  const text = content.replace(/<[^>]+>/g, " ");
  const matches = text.match(/https?:\/\/[^\s<>"')\]]+/gi);
  if (!matches) return 0;
  // Also check inside href attributes
  const hrefMatches = content.match(/href="(https?:\/\/[^"]+)"/gi) || [];
  const allUrls = [...matches, ...hrefMatches.map(m => m.replace(/^href="/, "").replace(/"$/, ""))];
  return new Set(allUrls.map(u => u.replace(/[.,;:!?)]+$/, ""))).size;
}

/**
 * Detects if content already contains a manually formatted CTA button
 * (e.g. an <a> tag with inline button-like styles).
 */
export function detectManualCtaButton(content: string): boolean {
  if (!content) return false;
  // Look for <a> tags with button-like styling
  const buttonPatterns = [
    /style="[^"]*padding[^"]*border-radius[^"]*"/i,
    /style="[^"]*background-color[^"]*padding[^"]*"/i,
    /style="[^"]*display:\s*inline-block[^"]*background[^"]*"/i,
  ];
  // Extract <a> tags and check if any look like buttons
  const aTags = content.match(/<a\s[^>]*>/gi) || [];
  return aTags.some(tag =>
    buttonPatterns.some(pattern => pattern.test(tag))
  );
}

// ─── CTA Generation ──────────────────────────────────────────────

export interface CtaButtonConfig {
  text: string;
  backgroundColor: string;
  fontColor: string;
  url: string;
}

/**
 * Generates a standardized, email-client-compatible CTA button HTML.
 * Uses inline styles for maximum compatibility (Outlook, Gmail, etc).
 */
export function generateCtaButtonHtml(config: CtaButtonConfig): string {
  const { text, backgroundColor, fontColor, url } = config;
  return `<div style="margin:24px 0;text-align:left;">
  <a href="${url}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background-color:${backgroundColor};color:${fontColor};padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;font-family:Arial,Helvetica,sans-serif;line-height:1.4;mso-padding-alt:0;text-align:center;">
    <!--[if mso]><i style="letter-spacing:28px;mso-font-width:-100%;mso-text-raise:21pt">&nbsp;</i><![endif]-->
    <span style="mso-text-raise:10pt;font-weight:600;">${text}</span>
    <!--[if mso]><i style="letter-spacing:28px;mso-font-width:-100%">&nbsp;</i><![endif]-->
  </a>
</div>`;
}

// ─── Channel Labels ──────────────────────────────────────────────
export const CHANNEL_LABELS: Record<string, string> = {
  email: "E-mail",
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
};
