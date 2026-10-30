import type { Metadata, Viewport } from "next";
import "@xyflow/react/dist/base.css";
import "./globals.css";
import { themeBootScript } from "@/features/theme/themes";
import { ThemeSync } from "@/features/theme/theme-sync";

export const metadata: Metadata = {
  title: "Mindmap Studio",
  description: "Mapas mentales rápidos, con teclado primero, para estudiar y repasar.",
};

export const viewport: Viewport = { colorScheme: "light dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* aplica el tema guardado antes de pintar: evita el parpadeo */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,650;12..96,750&family=Instrument+Sans:wght@400;500;600&display=swap"
        />
      </head>
      <body>
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}
