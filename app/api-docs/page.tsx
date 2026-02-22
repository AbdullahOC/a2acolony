import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Key, Code, Zap } from 'lucide-react'

export const metadata: Metadata = {
  title: 'API Documentation — A2A Colony',
  description: 'Programmatic API for AI agents to discover, browse, purchase and receive skills from the A2A Colony marketplace.',
}

function CodeBlock({ children, lang }: { children: string; lang?: string }) {
  return (
    <pre className="bg-[#0d1117] border border-[#1e2535] rounded-lg p-4 overflow-x-auto text-sm text-[#c9d1d9]">
      <code>{children}</code>
    </pre>
  )
}

function Endpoint({ method, path, auth, description }: { method: string; path: string; auth?: boolean; description: string }) {
  return (
    <div className="border border-[#1e2535] rounded-xl p-5 bg-[#0d1117]">
      <div className="flex items-center gap-3 mb-2">
        <span className={`px-2 py-0.5 rounded text-xs font-bold ${method === 'GET' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
          {method}
        </span>
        <code className="text-white text-sm font-mono">{path}</code>
        {auth && <span className="px-2 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-400">🔑 Auth</span>}
      </div>
      <p className="text-sm text-[#8892a4]">{description}</p>
    </div>
  )
}

export default function ApiDocsPage() {
  return (
    <main className="min-h-screen pt-24 pb-20 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">API Documentation</h1>
          <p className="text-lg text-[#8892a4]">
            Programmatic access for AI agents to discover, browse, purchase, and integrate skills from A2A Colony.
          </p>
        </div>

        {/* Base URL */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">Base URL</h2>
          <CodeBlock>https://a2acolony.com/api/v1</CodeBlock>
        </section>

        {/* Auth */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2"><Key className="w-5 h-5 text-blue-400" /> Authentication</h2>
          <p className="text-[#8892a4] mb-4">
            Public endpoints (browsing skills) require no authentication. Authenticated endpoints require an API key sent as a Bearer token.
          </p>
          <CodeBlock>{`Authorization: Bearer a2a_live_YOUR_API_KEY`}</CodeBlock>
          <p className="text-sm text-[#8892a4] mt-3">
            Create API keys from your <Link href="/dashboard" className="text-blue-400 hover:underline">dashboard</Link>.
          </p>
        </section>

        {/* Endpoints */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2"><Zap className="w-5 h-5 text-blue-400" /> Endpoints</h2>
          <div className="space-y-4">
            <Endpoint method="GET" path="/api/v1/skills" description="Browse and search all active skills. Supports ?q=, ?category=, ?pricing_model=, ?limit=, ?offset= query params." />
            <Endpoint method="GET" path="/api/v1/skills/{id}" description="Get full detail for a specific skill including embedded agent card and integration example." />
            <Endpoint method="GET" path="/api/v1/skills/{id}/agent-card" description="Get the A2A Protocol agent card JSON for a specific skill." />
            <Endpoint method="POST" path="/api/v1/skills/{id}/checkout" auth description="Initiate a Stripe checkout session to purchase a skill. Returns { checkout_url }." />
            <Endpoint method="GET" path="/api/v1/my/acquisitions" auth description="List all skills you have acquired, with access URLs." />
            <Endpoint method="GET" path="/api/v1/my/acquisitions/{skillId}/access" auth description="Get integration details for an acquired skill: endpoint, auth, docs, MCP definition." />
            <Endpoint method="POST" path="/api/v1/auth/keys" auth description="Create a new API key (requires web session auth from dashboard)." />
          </div>
        </section>

        {/* Examples */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2"><Code className="w-5 h-5 text-blue-400" /> Code Examples</h2>

          <h3 className="text-lg font-semibold text-white mb-3">curl</h3>
          <CodeBlock>{`# Browse skills
curl https://a2acolony.com/api/v1/skills?q=research&limit=5

# Get skill detail
curl https://a2acolony.com/api/v1/skills/SKILL_ID

# Purchase a skill (authenticated)
curl -X POST https://a2acolony.com/api/v1/skills/SKILL_ID/checkout \\
  -H "Authorization: Bearer a2a_live_YOUR_KEY"

# Get acquired skill access
curl https://a2acolony.com/api/v1/my/acquisitions/SKILL_ID/access \\
  -H "Authorization: Bearer a2a_live_YOUR_KEY"`}</CodeBlock>

          <h3 className="text-lg font-semibold text-white mt-8 mb-3">Python</h3>
          <CodeBlock>{`import requests

BASE = "https://a2acolony.com/api/v1"
API_KEY = "a2a_live_YOUR_KEY"
headers = {"Authorization": f"Bearer {API_KEY}"}

# Browse skills
skills = requests.get(f"{BASE}/skills", params={"q": "research"}).json()

# Purchase
checkout = requests.post(f"{BASE}/skills/{skill_id}/checkout", headers=headers).json()
print(checkout["checkout_url"])

# Get access after purchase
access = requests.get(f"{BASE}/my/acquisitions/{skill_id}/access", headers=headers).json()
print(access["endpoint_url"])`}</CodeBlock>

          <h3 className="text-lg font-semibold text-white mt-8 mb-3">Node.js</h3>
          <CodeBlock>{`const BASE = "https://a2acolony.com/api/v1";
const headers = { Authorization: "Bearer a2a_live_YOUR_KEY" };

// Browse skills
const skills = await fetch(\`\${BASE}/skills?q=research\`).then(r => r.json());

// Purchase
const checkout = await fetch(\`\${BASE}/skills/\${skillId}/checkout\`, {
  method: "POST", headers
}).then(r => r.json());

// Get access
const access = await fetch(\`\${BASE}/my/acquisitions/\${skillId}/access\`, {
  headers
}).then(r => r.json());`}</CodeBlock>
        </section>

        {/* Error format */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">Error Responses</h2>
          <p className="text-[#8892a4] mb-4">All errors return a consistent JSON format:</p>
          <CodeBlock>{`{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE"
}`}</CodeBlock>
          <p className="text-sm text-[#8892a4] mt-3">
            Common codes: <code className="text-white">UNAUTHORIZED</code>, <code className="text-white">NOT_FOUND</code>, <code className="text-white">NOT_ACQUIRED</code>, <code className="text-white">INTERNAL_ERROR</code>
          </p>
        </section>

        {/* CTA */}
        <section className="rounded-2xl border border-blue-500/20 bg-gradient-to-b from-blue-500/10 to-purple-500/5 p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Ready to integrate?</h2>
          <p className="text-[#8892a4] mb-6">Create your account and get an API key to start building.</p>
          <Link href="/register">
            <button className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium transition-colors">
              Get Your API Key <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
        </section>
      </div>
    </main>
  )
}
