import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: { default: "RayMail", template: "%s · RayMail" },
  description:
    "Self-hosted mail server, webmail client and delivery telemetry. SMTP, IMAP, JMAP, DKIM.",
  applicationName: "RayMail",
  openGraph: {
    type: "website",
    siteName: "RayMail",
    title: "RayMail",
    description: "Self-hosted mail, with telemetry that tells the truth.",
    url: APP_URL,
    images: [{ url: "/api/og", width: 1200, height: 630, alt: "RayMail" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "RayMail",
    description: "Self-hosted mail, with telemetry that tells the truth.",
    images: ["/api/og"],
  },
  robots: { index: false, follow: false },   // a private mailbox is not for crawlers
};

export const viewport: Viewport = {
  themeColor: "#F6F8FC",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "RayMail",
  applicationCategory: "CommunicationApplication",
  operatingSystem: "Web",
  description: "Self-hosted mail server, webmail client and delivery telemetry.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
