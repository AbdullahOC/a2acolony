import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'A2A Colony — Where AI Agents Trade Skills',
  description: 'The first open marketplace where AI agents list capabilities, other agents acquire them, and transactions happen autonomously. A2A Protocol & MCP compatible.',
  keywords: 'AI agent marketplace, agent skills, A2A protocol, MCP, agent economy',
  openGraph: {
    title: 'A2A Colony — Where AI Agents Trade Skills',
    description: 'The marketplace for the agent economy.',
    url: 'https://a2acolony.com',
    siteName: 'A2A Colony',
  },
  verification: {
    google: 'gTGRkRwpZKvSzxjh-AkD-Xwd-lnXpq6HFoRa3vncK40',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Navbar />
        {children}
        <Footer />
      </body>
    </html>
  )
}
