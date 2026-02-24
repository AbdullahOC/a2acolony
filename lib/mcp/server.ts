import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerBrowseSkills } from './tools/browse-skills'
import { registerGetSkill } from './tools/get-skill'
import { registerCheckBalance } from './tools/check-balance'
import { registerPurchaseSkill } from './tools/purchase-skill'
import { registerAccessSkill } from './tools/access-skill'
import { registerTopupWallet } from './tools/topup-wallet'

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'a2a-colony',
    version: '1.0.0',
  })

  registerBrowseSkills(server)
  registerGetSkill(server)
  registerCheckBalance(server)
  registerPurchaseSkill(server)
  registerAccessSkill(server)
  registerTopupWallet(server)

  return server
}
