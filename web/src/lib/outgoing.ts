import juice from "juice";
import { openToken, clickToken } from "@/lib/telemetry";

/* Mutations applied to outgoing HTML, in order:
 *   1. inline CSS      — Gmail and Outlook strip <style>; juice folds it into
 *                        style="" attributes so the message survives both.
 *   2. rewrite links   — each href routed through the signed click redirector.
 *   3. append pixel    — 1x1 transparent GIF, cache-busted, served no-store. */

export interface TrackingOptions {
  trackedId: string;
  appUrl: string;
  trackOpens: boolean;
  trackClicks: boolean;
}

// ponytail: attribute-level regex rather than a DOM parse. Correct for the
// composer's own output; swap in parse5 if we ever forward third-party HTML.
const HREF = /href\s*=\s*["']([^"']+)["']/gi;

const SKIP = /^(mailto:|tel:|sms:|#|javascript:|data:)/i;

export function rewriteLinks(html: string, o: TrackingOptions): string {
  if (!o.trackClicks) return html;
  return html.replace(HREF, (match, url: string) => {
    if (SKIP.test(url.trim())) return match;
    if (!/^https?:\/\//i.test(url.trim())) return match;
    const token = clickToken(o.trackedId, url.trim());
    return `href="${o.appUrl}/api/t/c/${token}"`;
  });
}

export function appendPixel(html: string, o: TrackingOptions): string {
  if (!o.trackOpens) return html;
  // The cache-buster defeats proxy caches that would otherwise swallow a
  // second open from the same recipient.
  const src = `${o.appUrl}/api/t/o/${openToken(o.trackedId)}?_=${Date.now().toString(36)}`;
  const pixel =
    `<img src="${src}" width="1" height="1" alt="" ` +
    `style="display:block;width:1px;height:1px;border:0;outline:0" />`;
  return /<\/body>/i.test(html)
    ? html.replace(/<\/body>/i, `${pixel}</body>`)
    : html + pixel;
}

export function prepareOutgoingHtml(html: string, o: TrackingOptions): string {
  let out = html;
  try {
    out = juice(out);
  } catch {
    // A malformed fragment must never block the send; ship it un-inlined.
  }
  out = rewriteLinks(out, o);
  out = appendPixel(out, o);
  return out;
}

/** 1x1 fully transparent GIF. */
export const PIXEL_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);
