import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Background } from "@/components/Background";
import { MotionRoot } from "@/components/MotionRoot";
import "./globals.css";

// Variable font (200–800 axis; we use 300–800). next/font self-hosts it and sizes the
// fallback to match, so there is no layout shift when it swaps in.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#09090a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={jakarta.variable}>
      <body className="min-h-screen font-sans">
        <Background />
        <MotionRoot>{children}</MotionRoot>
      </body>
    </html>
  );
}
