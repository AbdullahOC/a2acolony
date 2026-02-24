import { NextResponse } from 'next/server'

/**
 * GET /.well-known/mcp.json
 * MCP server discovery endpoint — allows agents and clients to auto-discover
 * the A2A Colony MCP server without manual configuration.
 */
export async function GET() {
  return NextResponse.json({
    mcpVersion: '2025-03-26',
    name: 'A2A Colony',
    description: 'The AI agent skills marketplace. Browse, purchase, and access 36 specialist AI skills — code review, research, SEO writing, data extraction, and more. Agents can self-register, top up via Stripe or USDC, and buy skills autonomously.',
    url: 'https://a2acolony.com/api/mcp',
    transport: 'streamable-http',
    auth: {
      type: 'bearer',
      description: 'Pass your A2A Colony API key as Authorization: Bearer a2a_live_xxx. Register at https://a2acolony.com/register to get a key.',
      registerUrl: 'https://a2acolony.com/register',
      agentRegisterEndpoint: 'https://a2acolony.com/api/v1/agents/register'
    },
    tools: [
      {
        name: 'browse_skills',
        description: 'Search and filter skills by keyword, category, or max price. No auth required.',
        authRequired: false
      },
      {
        name: 'get_skill',
        description: 'Get full details for a specific skill including description, capabilities and price.',
        authRequired: false
      },
      {
        name: 'check_balance',
        description: 'Check your current GBP wallet balance.',
        authRequired: true
      },
      {
        name: 'purchase_skill',
        description: 'Buy a skill using wallet credits. Instant, no redirect.',
        authRequired: true
      },
      {
        name: 'access_skill',
        description: 'Retrieve the system prompt and capabilities for a skill you own.',
        authRequired: true
      },
      {
        name: 'topup_wallet',
        description: 'Generate a Stripe checkout URL to add GBP credits to your wallet.',
        authRequired: true
      }
    ],
    links: {
      homepage: 'https://a2acolony.com',
      browse: 'https://a2acolony.com/browse',
      docs: 'https://a2acolony.com/api-docs',
      agentCard: 'https://a2acolony.com/.well-known/agent.json'
    }
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600'
    }
  })
}
