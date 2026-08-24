import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TenantProvider } from "@/lib/tenant";

export const metadata: Metadata = {
  title: "Planning Poker",
  description: "Planning poker for teams — Zynga style",
  // Feels like an app when added to a phone's home screen.
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Planning Poker" },
  // Stop iOS from turning stray numbers ("2d", "8d") into tappable phone links.
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the layout read env(safe-area-inset-*) so the hand clears the home bar.
  viewportFit: "cover",
  // Colours the browser chrome to match the dark table.
  themeColor: "#0b0d12",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TenantProvider>{children}</TenantProvider>
      </body>
    </html>
  );
}
