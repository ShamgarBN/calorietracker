// tracker-food-search — unified food lookup proxy.
//
// POST body: { q?: string, barcode?: string, pageSize?: number }
//   - q: text search across USDA FoodData Central (generic, ranked first) + Open
//     Food Facts (branded). Returns normalized FoodResult[] (nutrients per 100g).
//   - barcode: Open Food Facts product lookup → single FoodResult (or null).
//
// Why a proxy (not direct browser calls): keeps the USDA key off the public site,
// dodges CORS, sets a proper OFF User-Agent, and ranks/dedupes in one place.
//
// JWT is verified by default (only your logged-in app can call it).

import { corsHeaders, json } from '../_shared/cors.ts'
import { USDA_TO_KEY, OFF_TO_KEY, type Nutrients } from '../_shared/nutrients.ts'

const USDA_KEY = Deno.env.get('USDA_API_KEY') ?? ''
const OFF_UA = 'CalorieTracker/0.1 (personal PWA; https://github.com)'
const USDA_GENERIC = new Set(['Foundation', 'SR Legacy', 'Survey (FNDDS)'])

interface Serving {
  label: string
  grams: number
}
interface FoodResult {
  source: 'usda' | 'off'
  source_id: string
  barcode: string | null
  name: string
  brand: string | null
  is_generic: boolean
  nutrients: Nutrients
  servings: Serving[]
  default_serving: number
}

// fetch + JSON with a hard timeout, so one slow/blocked source can't stall search.
async function fetchJson(
  url: string | URL,
  init: RequestInit = {},
  ms = 6000,
): Promise<Record<string, unknown>> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

// ---- USDA ------------------------------------------------------------------
async function searchUsda(q: string, pageSize: number): Promise<FoodResult[]> {
  if (!USDA_KEY) return [] // gracefully skip if no key configured
  // POST with a JSON body: dataType is an array, so we avoid the URL-encoding
  // pitfalls of "Survey (FNDDS)" (spaces + parens) in the query string.
  // GENERIC types only — clean reference data. Branded/packaged is owned by OFF.
  const data = await fetchJson(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${USDA_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      query: q,
      pageSize,
      dataType: ['Foundation', 'SR Legacy', 'Survey (FNDDS)'],
    }),
  })
  return ((data.foods as Record<string, unknown>[]) ?? []).map(normalizeUsda).filter(Boolean) as FoodResult[]
}

function normalizeUsda(food: Record<string, unknown>): FoodResult | null {
  const name = String(food.description ?? '').trim()
  if (!name) return null
  const foodNutrients = ((food.foodNutrients as Record<string, unknown>[]) ?? [])
  const nutrients: Nutrients = {}
  for (const fn of foodNutrients) {
    const key = USDA_TO_KEY[String(fn.nutrientNumber)]
    const value = fn.value
    if (key && typeof value === 'number') nutrients[key] = value
  }
  // Energy fallback: some Foundation foods omit 208 and report kcal only under the
  // Atwater factors (957 specific / 958 general). All are kcal.
  if (nutrients.energy == null) {
    for (const num of ['957', '958']) {
      const fn = foodNutrients.find((x) => String(x.nutrientNumber) === num && typeof x.value === 'number')
      if (fn) {
        nutrients.energy = fn.value as number
        break
      }
    }
  }
  const servings: Serving[] = [{ label: '100 g', grams: 100 }]
  const ss = Number(food.servingSize)
  const unit = String(food.servingSizeUnit ?? '').toLowerCase()
  if (Number.isFinite(ss) && ss > 0 && (unit === 'g' || unit === 'ml')) {
    servings.push({ label: `1 serving (${ss} ${unit})`, grams: ss })
  }
  if (nutrients.energy == null) return null // skip incomplete entries (no calories)
  const dataType = String(food.dataType ?? '')
  return {
    source: 'usda',
    source_id: String(food.fdcId),
    barcode: (food.gtinUpc as string) ?? null,
    name,
    brand: (food.brandName as string) ?? (food.brandOwner as string) ?? null,
    is_generic: USDA_GENERIC.has(dataType),
    nutrients,
    servings,
    default_serving: servings.length > 1 ? 1 : 0,
  }
}

// ---- Open Food Facts -------------------------------------------------------
const OFF_FIELDS = 'code,product_name,generic_name,brands,nutriments,serving_size'

async function searchOff(q: string, pageSize: number): Promise<FoodResult[]> {
  // Search-a-licious is OFF's current search backend — fast and reliable, unlike
  // the legacy CGI / api/v2 search which intermittently 503 from datacenter IPs.
  const url = new URL('https://search.openfoodfacts.org/search')
  url.searchParams.set('q', q)
  url.searchParams.set('page_size', String(pageSize))
  url.searchParams.set('fields', OFF_FIELDS)
  const data = await fetchJson(url, { headers: { 'User-Agent': OFF_UA, Accept: 'application/json' } })
  return ((data.hits as Record<string, unknown>[]) ?? [])
    .map(normalizeOff)
    .filter(Boolean) as FoodResult[]
}

async function lookupBarcodeOff(barcode: string): Promise<FoodResult | null> {
  // The product endpoint is reliable (unlike search); v2 by barcode is fine.
  const url = new URL(`https://world.openfoodfacts.org/api/v2/product/${barcode}`)
  url.searchParams.set('fields', OFF_FIELDS)
  try {
    const data = await fetchJson(url, { headers: { 'User-Agent': OFF_UA, Accept: 'application/json' } })
    if (data.status !== 1 || !data.product) return null
    return normalizeOff(data.product as Record<string, unknown>)
  } catch {
    return null
  }
}

function normalizeOff(product: Record<string, unknown>): FoodResult | null {
  const name = String(product.product_name || product.generic_name || '').trim()
  if (!name) return null
  const nm = (product.nutriments as Record<string, number>) ?? {}
  const nutrients: Nutrients = {}
  for (const [offKey, ourKey] of Object.entries(OFF_TO_KEY)) {
    const v = nm[`${offKey}_100g`]
    if (typeof v === 'number') nutrients[ourKey] = v
  }
  // Energy fallback: derive kcal from kJ if kcal absent.
  if (nutrients.energy == null) {
    const kj = nm['energy-kj_100g'] ?? nm['energy_100g']
    if (typeof kj === 'number') nutrients.energy = Math.round(kj / 4.184)
  }
  if (nutrients.energy == null) return null // skip products with no calorie data
  const servings: Serving[] = [{ label: '100 g', grams: 100 }]
  const grams = parseServingGrams(String(product.serving_size ?? ''))
  if (grams) servings.push({ label: `1 serving (${grams} g)`, grams })
  // `brands` is a comma-string on legacy endpoints, an array on Search-a-licious.
  const brandRaw = product.brands
  const brand = Array.isArray(brandRaw)
    ? (String(brandRaw[0] ?? '').trim() || null)
    : String(brandRaw ?? '').split(',')[0].trim() || null
  return {
    source: 'off',
    source_id: String(product.code),
    barcode: String(product.code),
    name,
    brand,
    is_generic: false,
    nutrients,
    servings,
    default_serving: servings.length > 1 ? 1 : 0,
  }
}

/** "30 g", "1 cup (240ml)", "2.5 oz" → grams when we can confidently parse. */
function parseServingGrams(s: string): number | null {
  const m = s.match(/([\d.]+)\s*(g|ml)\b/i)
  if (m) {
    const n = parseFloat(m[1])
    return Number.isFinite(n) && n > 0 ? n : null
  }
  return null
}

// ---- Ranking + dedupe ------------------------------------------------------
function rankAndDedupe(usda: FoodResult[], off: FoodResult[], limit: number): FoodResult[] {
  const seen = new Set<string>()
  const out: FoodResult[] = []
  const push = (f: FoodResult) => {
    if (out.length >= limit) return
    const k = `${f.name}|${f.brand ?? ''}`.toLowerCase()
    if (seen.has(k)) return
    seen.add(k)
    out.push(f)
  }
  // Clean USDA generics rank first, but reserve ~40% of slots for Open Food Facts
  // so a branded query ("oreo") still surfaces the actual packaged product.
  const offReserve = Math.min(off.length, Math.floor(limit * 0.4))
  const usdaSlots = limit - offReserve
  usda.slice(0, usdaSlots).forEach(push)
  off.slice(0, offReserve).forEach(push)
  // Backfill any leftover capacity from whichever source has more.
  for (const f of [...usda.slice(usdaSlots), ...off.slice(offReserve)]) push(f)
  return out
}

// ---- Handler ---------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  let body: { q?: string; barcode?: string; pageSize?: number }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid JSON body' }, 400)
  }

  const pageSize = Math.min(Math.max(body.pageSize ?? 20, 1), 40)

  try {
    if (body.barcode) {
      const result = await lookupBarcodeOff(body.barcode.trim())
      return json({ results: result ? [result] : [] })
    }

    const q = (body.q ?? '').trim()
    if (q.length < 2) return json({ results: [] })

    // Each source fails independently — one being down still returns the other.
    const [usda, off] = await Promise.all([
      searchUsda(q, pageSize).catch((e) => {
        console.error('usda', e.message)
        return [] as FoodResult[]
      }),
      searchOff(q, pageSize).catch((e) => {
        console.error('off', e.message)
        return [] as FoodResult[]
      }),
    ])

    return json({ results: rankAndDedupe(usda, off, pageSize) })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'search failed' }, 500)
  }
})
