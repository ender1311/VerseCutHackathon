import type { Metadata, Viewport } from 'next';
import { AuthKitProvider } from '@workos-inc/authkit-nextjs/components';
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
        {/* Inter drives the whole app UI (readability). Fraunces and Plus
            Jakarta Sans stay loaded for the canvas compositor (ctx.font), which
            references those family names directly for the rendered ad text. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400..700&family=Plus+Jakarta+Sans:ital,wght@0,400..800;1,400..600&family=Fraunces:ital,opsz,wght@0,9..144,400..600;1,9..144,400..600&display=swap"
          rel="stylesheet"
        />
        <AuthKitProvider>{children}</AuthKitProvider>
      </body>
    </html>
  );
}
