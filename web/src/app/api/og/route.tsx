import { ImageResponse } from "next/og";

export const runtime = "nodejs";

/** Dynamic OpenGraph card. /api/og?title=...&subtitle=... */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title")?.slice(0, 90) ?? "RayMail";
  const subtitle =
    searchParams.get("subtitle")?.slice(0, 120) ?? "Self-hosted mail, with telemetry that tells the truth.";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          justifyContent: "space-between", background: "#08080A", padding: 72,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          // A single hairline frame instead of a gradient wash.
          border: "1px solid #212128",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="52" height="52" viewBox="0 0 32 32" fill="none">
            <rect x="10" y="7" width="19" height="18" rx="2.5" stroke="#F4F4F6" strokeWidth="2" />
            <path d="M11.4 8.6 L19.5 16 L27.6 8.6" stroke="#F4F4F6" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" />
            <g stroke="#E5A13A" strokeWidth="2" strokeLinecap="round">
              <path d="M4.5 11.5 H7.5" /><path d="M1 16 H7.5" /><path d="M4.5 20.5 H7.5" />
            </g>
          </svg>
          {/* Satori requires explicit display on any node with >1 child. */}
          <div style={{ display: "flex", fontSize: 30, color: "#F4F4F6", letterSpacing: -0.5 }}>
            <span style={{ fontWeight: 600 }}>Ray</span>
            <span style={{ fontWeight: 400 }}>Mail</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 62, fontWeight: 600, color: "#F4F4F6", lineHeight: 1.1, letterSpacing: -2 }}>
            {title}
          </div>
          <div style={{ fontSize: 27, color: "#8E8E9C", lineHeight: 1.4 }}>{subtitle}</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 20, color: "#6B6B78" }}>
          <div style={{ width: 34, height: 2, background: "#E5A13A" }} />
          <span>SMTP · IMAP · JMAP · DKIM</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
