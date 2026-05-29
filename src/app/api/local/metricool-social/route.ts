import { NextRequest, NextResponse } from 'next/server'
import { access, appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { requireRole } from '@/lib/auth'
import { runCommand } from '@/lib/command'
import { config } from '@/lib/config'
import {
  BUSINESS_KEYS,
  BUSINESSES,
  PROVIDERS,
  buildSchedulePlan,
  buildSplitDefinition,
  createDefaultCaptions,
  normalizeProvider,
  normalizeStatus,
  sanitizeCaption,
  slugPart,
  type BusinessKey,
  type CaptionSet,
  type Provider,
  type SocialVideoItem,
} from '@/lib/metricool-social-workflow'

const METRICOOL_AGENT_DIR = process.env.METRICOOL_SOCIAL_AGENT_DIR
  || join(homedir(), 'Projects', 'active', 'metricool-social-agent')
const SOCIAL_DATA_DIR = join(config.dataDir, 'metricool-social')
const AUDIT_PATH = join(SOCIAL_DATA_DIR, 'audit.jsonl')
const STATE_PATH = join(SOCIAL_DATA_DIR, 'state.json')
const TMP_DIR = join(SOCIAL_DATA_DIR, 'tmp')
let stateMutationQueue: Promise<unknown> = Promise.resolve()

const BELLARA_AUTOLIST_SOURCES = [
  {
    campaign: 'signature-shorts',
    campaignName: 'Bellara Signature Shorts',
    modelName: 'Signature Model',
    productUrl: 'https://bellarabrass.com/products/signature-model',
    sourcePath: join(METRICOOL_AGENT_DIR, 'outputs', 'bellara-signature-short-autolist-holding-bin-2026-05-22.json'),
  },
  {
    campaign: 'artist-shorts',
    campaignName: 'Bellara Artist Shorts',
    modelName: 'Artist Model',
    productUrl: 'https://bellarabrass.com/products/artist-model',
    sourcePath: join(METRICOOL_AGENT_DIR, 'outputs', 'bellara-artist-short-autolist-holding-bin-2026-05-22.json'),
  },
] as const

interface PersistedState {
  items: Record<string, Partial<Pick<SocialVideoItem, 'status' | 'captions' | 'draftIds' | 'scheduledPosts' | 'updatedAt'>>>
}

interface AuditEntry {
  timestamp: string
  actor: string
  action: string
  business?: string
  itemId?: string
  ids?: string[]
  ok: boolean
  durationMs: number
  error?: string
}

function sanitizeText(input: unknown): string {
  return String(input || '')
    .replace(/([A-Za-z0-9_-]{64,})/g, '[redacted]')
    .slice(0, 800)
}

async function appendAudit(entry: AuditEntry) {
  try {
    await mkdir(SOCIAL_DATA_DIR, { recursive: true })
    await appendFile(AUDIT_PATH, `${JSON.stringify(entry)}\n`, 'utf8')
  } catch {
    // Best-effort local audit logging only.
  }
}

async function readAudit(limit = 30): Promise<AuditEntry[]> {
  try {
    const raw = await readFile(AUDIT_PATH, 'utf8')
    return raw.trim().split(/\r?\n/).filter(Boolean).slice(-limit).map((line) => JSON.parse(line)).reverse()
  } catch {
    return []
  }
}

async function readState(): Promise<PersistedState> {
  try {
    return JSON.parse(await readFile(STATE_PATH, 'utf8')) as PersistedState
  } catch {
    return { items: {} }
  }
}

async function writeState(state: PersistedState) {
  await mkdir(SOCIAL_DATA_DIR, { recursive: true })
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2), 'utf8')
}

async function withStateMutation<T>(fn: () => Promise<T>): Promise<T> {
  const run = stateMutationQueue.then(fn, fn)
  stateMutationQueue = run.then(() => undefined, () => undefined)
  return run
}

async function assertAgentAvailable() {
  await access(join(METRICOOL_AGENT_DIR, 'src', 'cli.mjs'), constants.R_OK)
}

async function runMetricoolCli(args: string[]) {
  await assertAgentAvailable()
  const result = await runCommand('node', ['src/cli.mjs', ...args], {
    cwd: METRICOOL_AGENT_DIR,
    timeoutMs: 60_000,
    env: { ...process.env, FORCE_COLOR: '0' },
  })
  try {
    return JSON.parse(result.stdout)
  } catch {
    throw new Error(`Metricool agent returned non-JSON output: ${sanitizeText(result.stdout)}`)
  }
}

function inferFileName(url: string): string {
  try {
    return basename(new URL(url).pathname)
  } catch {
    return basename(url)
  }
}

async function readJsonFile(path: string) {
  return JSON.parse(await readFile(path, 'utf8'))
}

async function buildInventory(state: PersistedState): Promise<SocialVideoItem[]> {
  const items: SocialVideoItem[] = []
  for (const source of BELLARA_AUTOLIST_SOURCES) {
    try {
      const record = await readJsonFile(source.sourcePath)
      const createdPosts = Array.isArray(record.createdPosts) ? record.createdPosts : []
      for (const post of createdPosts) {
        const mediaUrl = String(post.mediaUrl || post.mediaUrls?.[0] || '')
        if (!mediaUrl) continue
        const feature = String(post.feature || post.text || inferFileName(mediaUrl))
        const id = `bellara-brass:${source.campaign}:${String(post.position ?? 0).padStart(2, '0')}-${slugPart(feature)}`
        const defaults = createDefaultCaptions({
          campaign: source.campaign,
          modelName: source.modelName,
          feature,
          productUrl: source.productUrl,
        })
        const override = state.items[id] || {}
        items.push({
          id,
          business: 'bellara-brass',
          campaign: source.campaign,
          campaignName: source.campaignName,
          modelName: source.modelName,
          productUrl: source.productUrl,
          feature,
          position: Number(post.position ?? 0),
          mediaUrl,
          fileName: post.fileName || inferFileName(mediaUrl),
          autolistId: Number(record.autolistId || 0),
          autolistName: String(record.autolistName || ''),
          autolistPostId: Number(post.autolistPostId || post.id || 0),
          sourcePath: source.sourcePath,
          status: override.status || 'needs_copy',
          captions: { ...defaults, ...(override.captions as Record<Provider, CaptionSet> || {}) },
          draftIds: override.draftIds || {},
          scheduledPosts: override.scheduledPosts || {},
          updatedAt: override.updatedAt,
        })
      }
    } catch {
      // Missing source files simply mean that campaign has no local inventory yet.
    }
  }
  return items.sort((a, b) => a.campaign.localeCompare(b.campaign) || a.position - b.position)
}

function scrubInventory(items: SocialVideoItem[]) {
  return items.map(({ sourcePath: _sourcePath, ...item }) => item)
}

async function loadBrandDashboard(business: typeof BUSINESSES[number]) {
  const [providersResult, libraryResult] = await Promise.allSettled([
    runMetricoolCli(['brand-providers', business.key]),
    runMetricoolCli(['library-list', business.key]),
  ])

  return {
    key: business.key,
    displayName: business.displayName,
    providers: providersResult.status === 'fulfilled' ? providersResult.value : null,
    library: libraryResult.status === 'fulfilled' ? libraryResult.value : null,
    error: providersResult.status === 'rejected'
      ? sanitizeText(providersResult.reason?.message || providersResult.reason)
      : libraryResult.status === 'rejected'
        ? sanitizeText(libraryResult.reason?.message || libraryResult.reason)
        : null,
  }
}

function normalizeIds(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input.map((id) => String(id).trim()).filter((id) => /^\d{1,12}$/.test(id)).slice(0, 50)
}

function normalizeBusiness(input: unknown): BusinessKey | null {
  const key = String(input || '').trim()
  return BUSINESS_KEYS.has(key) ? key as BusinessKey : null
}

function extractCreatedDraftIds(result: any, networks: Provider[]): Partial<Record<Provider, number>> {
  const created = Array.isArray(result?.created) ? result.created : []
  const draftIds: Partial<Record<Provider, number>> = {}
  for (const post of created) {
    const network = PROVIDERS.find((provider) => post?.networks?.[provider] === true)
    if (network && post?.id) draftIds[network] = Number(post.id)
  }
  const missing = networks.filter((network) => !draftIds[network])
  if (missing.length > 0) {
    throw new Error(`Metricool did not return visible draft IDs for: ${missing.join(', ')}`)
  }
  if (result && 'allVisible' in result && result.allVisible !== true) {
    throw new Error('Metricool created drafts, but visibility verification did not pass.')
  }
  return draftIds
}

async function writeTempDefinition(prefix: string, data: unknown): Promise<string> {
  await mkdir(TMP_DIR, { recursive: true })
  const path = join(TMP_DIR, `${prefix}-${Date.now()}.json`)
  await writeFile(path, JSON.stringify(data, null, 2), 'utf8')
  return path
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const action = request.nextUrl.searchParams.get('action') || 'dashboard'
  if (action !== 'dashboard') return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  const startedAt = Date.now()
  try {
    const state = await readState()
    const [brands, inventory] = await Promise.all([
      Promise.all(BUSINESSES.map(loadBrandDashboard)),
      buildInventory(state),
    ])
    await appendAudit({
      timestamp: new Date().toISOString(),
      actor: auth.user.username,
      action: 'dashboard',
      ok: true,
      durationMs: Date.now() - startedAt,
    })
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      providers: PROVIDERS,
      businesses: BUSINESSES,
      brands,
      inventory: scrubInventory(inventory),
      audit: await readAudit(),
    })
  } catch (error: any) {
    const entry = {
      timestamp: new Date().toISOString(),
      actor: auth.user.username,
      action: 'dashboard',
      ok: false,
      durationMs: Date.now() - startedAt,
      error: sanitizeText(error?.message || error),
    }
    await appendAudit(entry)
    return NextResponse.json({ error: entry.error }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const startedAt = Date.now()
  const body = await request.json().catch(() => ({}))
  const action = typeof body?.action === 'string' ? body.action : ''

  try {
    if (action === 'verify') {
      const business = normalizeBusiness(body?.business)
      const ids = normalizeIds(body?.ids)
      if (!business) return NextResponse.json({ error: 'Invalid business' }, { status: 400 })
      if (ids.length === 0) return NextResponse.json({ error: 'Provide at least one post id' }, { status: 400 })
      const result = await runMetricoolCli(['library-verify', business, ...ids])
      await appendAudit({ timestamp: new Date().toISOString(), actor: auth.user.username, action, business, ids, ok: true, durationMs: Date.now() - startedAt })
      return NextResponse.json({ ok: true, result, audit: await readAudit() })
    }

    if (action === 'save_item') {
      return withStateMutation(async () => {
        const state = await readState()
        const inventory = await buildInventory(state)
        const item = inventory.find((candidate) => candidate.id === body?.itemId)
        if (!item) return NextResponse.json({ error: 'Unknown inventory item' }, { status: 404 })
        const incomingCaptions = body?.captions && typeof body.captions === 'object' ? body.captions as Record<string, unknown> : {}
        const captions = { ...item.captions }
        for (const provider of PROVIDERS) {
          if (incomingCaptions[provider]) captions[provider] = sanitizeCaption(incomingCaptions[provider])
        }
        state.items[item.id] = {
          ...state.items[item.id],
          status: normalizeStatus(body?.status || item.status),
          captions,
          updatedAt: new Date().toISOString(),
        }
        await writeState(state)
        await appendAudit({ timestamp: new Date().toISOString(), actor: auth.user.username, action, business: item.business, itemId: item.id, ok: true, durationMs: Date.now() - startedAt })
        const savedItem = (await buildInventory(state)).find((candidate) => candidate.id === item.id)
        return NextResponse.json({ ok: true, item: savedItem ? scrubInventory([savedItem])[0] : null, audit: await readAudit() })
      })
    }

    if (action === 'create_drafts') {
      return withStateMutation(async () => {
        const state = await readState()
        const inventory = await buildInventory(state)
        const item = inventory.find((candidate) => candidate.id === body?.itemId)
        if (!item) return NextResponse.json({ error: 'Unknown inventory item' }, { status: 404 })
        const networks: Provider[] = Array.isArray(body?.networks)
          ? (body.networks as unknown[]).map(normalizeProvider).filter((network: Provider | null): network is Provider => Boolean(network))
          : PROVIDERS.slice()
        if (networks.length === 0) return NextResponse.json({ error: 'Select at least one network' }, { status: 400 })
        const incomingCaptions = body?.captions && typeof body.captions === 'object' ? body.captions as Record<string, unknown> : {}
        const captions = { ...item.captions }
        for (const provider of PROVIDERS) {
          if (incomingCaptions[provider]) captions[provider] = sanitizeCaption(incomingCaptions[provider])
        }
        const requestedStatus = normalizeStatus(body?.status || item.status)
        const approvedForDrafts = requestedStatus === 'approved' || requestedStatus === 'drafted' || item.status === 'approved' || item.status === 'drafted'
        if (!approvedForDrafts && body?.dryRun !== true) {
          return NextResponse.json({ error: 'Approve this video before creating Metricool drafts.' }, { status: 409 })
        }
        const duplicateNetworks = networks.filter((network) => item.draftIds?.[network])
        if (duplicateNetworks.length > 0 && body?.dryRun !== true) {
          return NextResponse.json({ error: `Draft IDs already exist for: ${duplicateNetworks.join(', ')}` }, { status: 409 })
        }
        const itemForDrafts: SocialVideoItem = { ...item, captions }
        const definition = buildSplitDefinition(itemForDrafts, networks)
        const definitionPath = await writeTempDefinition('library-split', definition)
        if (body?.dryRun === true) {
          const dryRun = await runMetricoolCli(['library-create-split', definitionPath, '--dry-run'])
          await appendAudit({ timestamp: new Date().toISOString(), actor: auth.user.username, action: 'create_drafts_dry_run', business: item.business, itemId: item.id, ok: true, durationMs: Date.now() - startedAt })
          return NextResponse.json({ ok: true, dryRun: true, result: dryRun, audit: await readAudit() })
        }
        const result = await runMetricoolCli(['library-create-split', definitionPath])
        const createdDraftIds = extractCreatedDraftIds(result, networks)
        const draftIds: Partial<Record<Provider, number>> = { ...item.draftIds, ...createdDraftIds }
        state.items[item.id] = {
          ...state.items[item.id],
          status: 'drafted',
          captions: itemForDrafts.captions,
          draftIds,
          updatedAt: new Date().toISOString(),
        }
        await writeState(state)
        await appendAudit({ timestamp: new Date().toISOString(), actor: auth.user.username, action, business: item.business, itemId: item.id, ids: Object.values(createdDraftIds).map(String), ok: true, durationMs: Date.now() - startedAt })
        const savedItem = (await buildInventory(state)).find((candidate) => candidate.id === item.id)
        return NextResponse.json({ ok: true, result, item: savedItem ? scrubInventory([savedItem])[0] : null, audit: await readAudit() })
      })
    }

    if (action === 'schedule_plan') {
      const state = await readState()
      const inventory = await buildInventory(state)
      const plan = buildSchedulePlan(inventory, body || {})
      await appendAudit({ timestamp: new Date().toISOString(), actor: auth.user.username, action, business: 'bellara-brass', ok: true, durationMs: Date.now() - startedAt })
      return NextResponse.json({ ok: true, dryRun: true, plan, audit: await readAudit() })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    const entry = {
      timestamp: new Date().toISOString(),
      actor: auth.user.username,
      action: action || 'unknown',
      ok: false,
      durationMs: Date.now() - startedAt,
      error: sanitizeText(error?.message || error),
    }
    await appendAudit(entry)
    return NextResponse.json({ error: entry.error, audit: await readAudit() }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
