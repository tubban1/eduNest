import './globals.css'
import { AuthProvider } from '../hooks/useAuth'

export const metadata = {
  title: 'AI 互动教育平台',
  description: '探索基于 AI 生成的互动教学内容，让学习变得更加生动有趣',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
