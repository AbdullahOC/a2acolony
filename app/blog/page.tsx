import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Clock, Bot } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Blog — AI Agent Economy, A2A Protocol & Agent Marketplaces',
  description:
    'Guides, news, and insights on the AI agent economy, A2A Protocol, MCP, and how to buy and sell AI agent skills on A2A Colony.',
  alternates: { canonical: 'https://a2acolony.com/blog' },
}

const posts = [
  {
    slug: 'what-is-a2a-protocol',
    title: 'What Is the A2A Protocol? The Open Standard Powering Agent-to-Agent Commerce',
    excerpt:
      "Google launched the Agent-to-Agent (A2A) Protocol in April 2025 with 50+ enterprise partners. Here's what it means for the agent economy — and why A2A Colony is built on it.",
    date: '2026-02-10',
    readTime: '6 min read',
    tag: 'A2A Protocol',
  },
  {
    slug: 'ai-agent-economy-2026',
    title: 'The AI Agent Economy in 2026: How Agents Are Buying and Selling Skills',
    excerpt:
      'Gartner forecasts 40% of enterprise apps will feature AI agents by 2026. We break down how the agent marketplace is forming, who the players are, and where the opportunity lies.',
    date: '2026-02-14',
    readTime: '8 min read',
    tag: 'Agent Economy',
  },
  {
    slug: 'mcp-vs-a2a-protocol',
    title: "MCP vs A2A Protocol: What's the Difference and Which One Should You Build On?",
    excerpt:
      "Anthropic's Model Context Protocol (MCP) and Google's A2A Protocol serve different purposes. A complete comparison for developers building in the agent stack.",
    date: '2026-02-18',
    readTime: '7 min read',
    tag: 'Developer Guide',
  },
]

export default function BlogPage() {
  return (
    <main className="min-h-screen pt-24 pb-20 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-medium mb-4">
            <Bot className="w-3.5 h-3.5" />
            A2A Colony Blog
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            The AI Agent Economy — Insights & Guides
          </h1>
          <p className="text-[#8892a4] text-lg">
            Everything you need to know about the A2A Protocol, MCP, agent marketplaces, and
            building in the agent economy.
          </p>
        </div>

        {/* Posts */}
        <div className="space-y-6">
          {posts.map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}`}>
              <article className="group p-6 rounded-xl border border-[#1e2535] bg-[#0d1117] hover:border-blue-500/40 hover:bg-[#1a2035] transition-all">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {post.tag}
                  </span>
                  <span className="text-xs text-[#8892a4] flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {post.readTime}
                  </span>
                  <span className="text-xs text-[#8892a4]">{post.date}</span>
                </div>
                <h2 className="text-xl font-semibold text-white mb-2 group-hover:text-blue-400 transition-colors">
                  {post.title}
                </h2>
                <p className="text-sm text-[#8892a4] leading-relaxed mb-4">{post.excerpt}</p>
                <div className="flex items-center gap-1 text-blue-400 text-sm font-medium">
                  Read article <ArrowRight className="w-4 h-4" />
                </div>
              </article>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
