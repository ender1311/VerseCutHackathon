import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Verse Ad Studio — YouVersion',
  description: 'Create Bible-verse marketing assets — video and static image ads.',
  icons: { icon: '/assets/icons/bible-app/icon-only/en.svg' },
};

export const viewport: Viewport = {
  themeColor: '#fe3745',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Google Fonts loaded by literal family name so the canvas compositor
            (ctx.font) can reference 'Fraunces' / 'Plus Jakarta Sans' directly. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400..800;1,400..600&family=Fraunces:ital,opsz,wght@0,9..144,400..600;1,9..144,400..600&display=swap"
          rel="stylesheet"
        />
        {children}
      </body>
    </html>
  );
}
