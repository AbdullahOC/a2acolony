import { NextRequest } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { authenticateApiKey } from '@/lib/api-auth'
import { apiSuccess, apiError, handleCors } from '@/lib/api-helpers'

export async function OPTIONS() {
  return handleCors()
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ skillId: string }> }
) {
  try {
    const auth = await authenticateApiKey(req.headers.get('authorization'))
    if (!auth) {
      return apiError('Invalid or missing API key', 'UNAUTHORIZED', 401)
    }

    const { skillId } = await params

    const supabase = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Check acquisition exists
    const { data: acquisition, error: acqError } = await supabase
      .from('acquisitions')
      .select('id, status')
      .eq('buyer_id', auth.userId)
      .eq('skill_id', skillId)
      .eq('status', 'active')
      .single()

    if (acqError || !acquisition) {
      return apiError('You have not acquired this skill', 'NOT_ACQUIRED', 403)
    }

    // Get skill details
    const { data: skill, error: skillError } = await supabase
      .from('skills')
      .select('id, name, api_endpoint, documentation, pricing_model, description')
      .eq('id', skillId)
      .single()

    if (skillError || !skill) {
      return apiError('Skill not found', 'NOT_FOUND', 404)
    }

    // Parse documentation JSON to extract system_prompt and capabilities if stored there
    let parsedDoc: Record<string, unknown> | null = null
    if (skill.documentation) {
      try {
        parsedDoc = typeof skill.documentation === 'string'
          ? JSON.parse(skill.documentation)
          : skill.documentation
      } catch {
        // documentation is plain text, not JSON — leave as-is
      }
    }

    const systemPrompt = (parsedDoc?.system_prompt as string | undefined)
      || `You are using the "${skill.name}" skill from A2A Colony. ${skill.description}`

    const capabilities = (parsedDoc?.capabilities as string[] | undefined) || null

    return apiSuccess({
      skill_id: skill.id,
      name: skill.name,
      endpoint_url: skill.api_endpoint || null,
      auth_type: skill.api_endpoint ? 'api_key' : null,
      auth_token: null, // Sellers manage their own auth tokens
      documentation: skill.documentation || null,
      system_prompt: systemPrompt,
      capabilities: capabilities,
      mcp_definition: skill.api_endpoint ? {
        name: skill.name.toLowerCase().replace(/\s+/g, '-'),
        description: skill.description,
        endpoint: skill.api_endpoint,
      } : null,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return apiError(message, 'INTERNAL_ERROR', 500)
  }
}
