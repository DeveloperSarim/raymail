import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%", display: "flex",
        alignItems: "center", justifyContent: "center", background: "#08080A",
      }}>
        <svg width="120" height="120" viewBox="0 0 32 32" fill="none">
          <rect x="10.5" y="9" width="16" height="15" rx="2" stroke="#F4F4F6" strokeWidth="2" />
          <path d="M11.7 10.4 L18.5 16.4 L25.3 10.4" stroke="#F4F4F6" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" />
          <g stroke="#E5A13A" strokeWidth="2" strokeLinecap="round">
            <path d="M4 16 H8" /><path d="M6.5 11 H8" /><path d="M6.5 21 H8" />
          </g>
        </svg>
      </div>
    ),
    size,
  );
}
