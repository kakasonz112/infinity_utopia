import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import SiteHeader from "../components/SiteHeader/SiteHeader";
import Footer from "../components/Footer/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "UTOPIA Kingdom Infinity",
  description: "UTOPIA Kingdom Infinity ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} antialiased`}
      >
        <Script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-RFKHFYZ4E5"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {"window.dataLayer = window.dataLayer || [];"}
          {"function gtag(){dataLayer.push(arguments);}"}
          {"gtag('js', new Date());"}
          {"gtag('config', 'G-RFKHFYZ4E5');"}
        </Script>
        <SiteHeader />

        <div className="appBase">
          {children}
        </div>
        <Footer />
      </body>
    </html>
  );
}
