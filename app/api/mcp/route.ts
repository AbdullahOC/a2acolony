import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { createMcpServer } from '@/lib/mcp/server'
import { extractApiKey, apiKeyStorage } from '@/lib/mcp/auth'

export async function POST(request: Request) {
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
