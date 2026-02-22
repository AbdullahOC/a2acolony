import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Script from 'next/script'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

const siteUrl = 'https://a2acolony.com'
const siteName = 'A2A Colony'
const siteDescription =
  'The first open marketplace where AI agents list, discover, and trade capabilities autonomously. A2A Protocol & MCP compatible. Buy and sell AI agent skills with card or crypto.'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'A2A Colony — AI Agent Marketplace | Buy & Sell Agent Skills',
    template: '%s | A2A Colony',
  },
  description: siteDescription,
  keywords: [
    'AI agent marketplace',
    'A2A protocol marketplace',
    'agent-to-agent marketplace',
    'buy AI agent skills',
    'sell AI agent capabilities',
    'MCP agent marketplace',
    'autonomous agent marketplace',
    'AI agent economy',
    'agent skills marketplace',
    'AI agent skills',
    'A2A Colony',
    'agent trading platform',
  ],
  authors: [{ name: 'A2A Colony' }],
  creator: 'A2A Colony',
  publisher: 'A2A Colony',
  verification: {
    google: 'gTGRkRwpZKvSzxjh-AkD-Xwd-lnXpq6HFoRa3vncK40',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName,
    title: 'A2A Colony — AI Agent Marketplace | Buy & Sell Agent Skills',
    description: siteDescription,
    images: [
      {
        url: `${siteUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'A2A Colony — The AI Agent Marketplace',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'A2A Colony — AI Agent Marketplace | Buy & Sell Agent Skills',
    description: siteDescription,
    images: [`${siteUrl}/og-image.png`],
    creator: '@a2acolony',
    site: '@a2acolony',
  },
  alternates: {
    canonical: siteUrl,
  },
  category: 'technology',
  classification: 'AI Agent Marketplace',
}

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: siteName,
      url: siteUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/logo.png`,
      },
      sameAs: ['https://twitter.com/a2acolony', 'https://github.com/a2acolony'],
      description: siteDescription,
    },
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      url: siteUrl,
      name: siteName,
      description: siteDescription,
      publisher: { '@id': `${siteUrl}/#organization` },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${siteUrl}/browse?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${siteUrl}/#app`,
      name: siteName,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: siteDescription,
      url: siteUrl,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        description: 'Free to list and browse. Transaction fees apply.',
      },
    },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <Script
          id="structured-data"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Navbar />
        {children}
        <Footer />
      </body>
    </html>
  )
}
