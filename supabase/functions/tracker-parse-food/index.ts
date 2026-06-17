// tracker-parse-food — parse a natural-language meal description into structured
// food items using Anthropic, e.g. "2 eggs and a cup of oats" -> [{name, grams}].
// The CLIENT then matches each item against the food DB and shows it for the user
// to confirm before logging (we never auto-log AI guesses).
//
// Cost guard: this endpoint calls a paid LLM, so we require a REAL signed-in user
// (a Supabase session JWT) — the public publishable key alone is rejected.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10'
import { corsHeaders, json } from '../_shared/cors.ts'

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
// Fast + cheap model for parsing.
const MODEL = 'claude-haiku-4-5-20251001'

const SYSTEM = `You convert a casual meal description into structured food items for a nutrition tracker.
Rules:
- Output one item per distinct food.
- "name" must be a generic, searchable food name (e.g. "egg", "rolled oats", "banana", "chicken breast") — no brands unless explicitly named.
- "grams" is your best estimate of the TOTAL grams eaten for that item, accounting for the quantity.
  Reference portions: 1 large egg ≈ 50 g; 1 cup dry oats ≈ 80 g; 1 cup cooked rice ≈ 158 g;
  1 medium banana ≈ 118 g; 1 slice bread ≈ 28 g; 1 tbsp oil/peanut butter ≈ 14–16 g;
  1 cup milk ≈ 244 g; 1 chicken breast ≈ 140 g.
- If a quantity is vague ("some", "a bit"), assume one typical serving.`

async function requireUser(req: Request): Promise<boolean> {
  const auth = req.headers.get('Authorization')
  if (!auth) return false
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
  })
  const { data } = await client.auth.getUser()
  return Boolean(data.user)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  if (!ANTHROPIC_KEY) return json({ error: 'AI logging not configured (no ANTHROPIC_API_KEY)' }, 503)

  if (!(await requireUser(req))) return json({ error: 'unauthorized' }, 401)

  let text = ''
  try {
    text = String((await req.json()).text ?? '').trim()
  } catch {
    return json({ error: 'invalid JSON body' }, 400)
  }
  if (text.length < 2) return json({ items: [] })

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM,
        tool_choice: { type: 'tool', name: 'log_items' },
        tools: [
          {
            name: 'log_items',
            description: 'Record the parsed food items.',
            input_schema: {
              type: 'object',
              properties: {
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string', description: 'generic searchable food name' },
                      grams: { type: 'number', description: 'estimated total grams eaten' },
                      note: { type: 'string', description: 'original phrase, e.g. "2 eggs"' },
                    },
                    required: ['name', 'grams'],
                  },
                },
              },
              required: ['items'],
            },
          },
        ],
        messages: [{ role: 'user', content: text }],
      }),
    })
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`)
    const data = await res.json()
    const toolUse = (data.content ?? []).find((c: { type: string }) => c.type === 'tool_use')
    const items = (toolUse?.input?.items ?? []) as { name: string; grams: number; note?: string }[]
    return json({ items })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'parse failed' }, 500)
  }
})
