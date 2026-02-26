import type { Metadata } from 'next'
import { Noto_Sans_JP, Syne } from 'next/font/google'

import { AppOverlayProvider } from '@/components/providers/AppOverlayProvider'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { THEME_STORAGE_KEY } from '@/lib/theme'

import './globals.css'

const syne = Syne({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-syne',
})

const notoSansJp = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-noto',
})

export const metadata: Metadata = {
  title: 'LifeBalance',
  description: '家計管理と将来設計ダッシュボード',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
  try {
    const savedTheme = localStorage.getItem('${THEME_STORAGE_KEY}');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      document.documentElement.dataset.theme = savedTheme;
    }
  } catch {
    // no-op
  }
})();`,
          }}
        />
      </head>
      <body className={`${syne.variable} ${notoSansJp.variable} font-body`}>
        <QueryProvider>
          {children}
          <AppOverlayProvider />
        </QueryProvider>
      </body>
    </html>
  )
}
