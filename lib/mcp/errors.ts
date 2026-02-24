export function mcpError(error: string, message: string, extra?: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error, message, ...extra }) }],
    isError: true as const,
  }
}

export function requireAuth() {
  return mcpError('auth_required', 'Provide your API key via Authorization: Bearer a2a_live_xxx header')
}
