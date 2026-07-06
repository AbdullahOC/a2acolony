import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { createMcpServer } from '@/lib/mcp/server'
import { extractApiKey, apiKeyStorage } from '@/lib/mcp/auth'
import { clientIp, withinRateLimit } from '@/lib/rate-limit'

export async function POST(request: Request) {
  const ip = clientIp(request)
  if (!(await withinRateLimit(`mcp:${ip}`, 120, 60))) {
    return new Response(
      JSON.stringify({ jsonrpc: '2.0', error: { code: -32029, message: 'Rate limit exceeded' }, id: null }),
      { status: 429, headers: { 'content-type': 'application/json' } }
    )
  }

  const apiKey = extractApiKey(request)
  const server = createMcpServer()
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  await server.connect(transport)
  return apiKeyStorage.run(apiKey, () => transport.handleRequest(request))
}

export async function GET() {
  return new Response('Method not allowed', { status: 405 })
}

export async function DELETE() {
  return new Response('Method not allowed', { status: 405 })
}
