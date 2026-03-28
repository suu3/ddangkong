import './globals.css';
import type { Metadata, Viewport } from 'next';
import Navigation from '@/components/@layout/Navigation';
import PwaRegistrar from '@/components/PwaRegistrar';
import { SoundProvider } from '@/lib/context/sound';

export const metadata: Metadata = {
  metadataBase: new URL('https://ddangkong.suulab.xyz'),
  title: {
    default: '심심풀이 땅콩',
    template: '%s | 심심풀이 땅콩',
  },
  description: '커피내기, 운명의 돌림판, 폭탄 돌리기, 랜덤 팀 나누기를 한곳에서 즐기는 복불복 게임 앱.',
  applicationName: '심심풀이 땅콩',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/logos/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/logos/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/logos/icon-192x192.png', sizes: '192x192', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '심심풀이 땅콩',
  },
  openGraph: {
    title: '심심풀이 땅콩',
    description: '여러 가지 복불복 게임을 모바일에서 바로 실행할 수 있는 웹앱.',
    url: 'https://ddangkong.suulab.xyz',
    siteName: '심심풀이 땅콩',
    locale: 'ko_KR',
    type: 'website',
    images: [
      {
        url: '/logos/icon-512x512.png',
        width: 512,
        height: 512,
        alt: '심심풀이 땅콩 앱 아이콘',
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: '#3d3131',
  colorScheme: 'light',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <SoundProvider>
          <PwaRegistrar />
          <Navigation />
          <main className="main">{children}</main>
        </SoundProvider>
      </body>
    </html>
  );
}
