export const PROVIDERS = ['facebook', 'instagram', 'youtube', 'tiktok'] as const
export const BUSINESSES = [
  { key: 'creative-state', displayName: 'Creative State' },
  { key: 'bellara-brass', displayName: 'Bellara Brass' },
  { key: 'heritage-trumpets', displayName: 'Heritage Trumpets' },
] as const

export type BusinessKey = typeof BUSINESSES[number]['key']
export type Provider = typeof PROVIDERS[number]
export type WorkflowStatus = 'needs_copy' | 'ready_for_review' | 'approved' | 'drafted' | 'scheduled' | 'published'

export interface CaptionSet {
  content: string
  firstCommentText?: string
  title?: string
  tags?: string[]
}

export interface SocialVideoItem {
  id: string
  business: BusinessKey
  campaign: string
  campaignName: string
  modelName: string
  productUrl: string
  feature: string
  position: number
  mediaUrl: string
  fileName: string
  autolistId: number
  autolistName: string
  autolistPostId: number
  sourcePath: string
  status: WorkflowStatus
  captions: Record<Provider, CaptionSet>
  draftIds: Partial<Record<Provider, number>>
  scheduledPosts: Partial<Record<Provider, number>>
  updatedAt?: string
}

export const BUSINESS_KEYS = new Set<string>(BUSINESSES.map((business) => business.key))
export const PROVIDER_KEYS = new Set<string>(PROVIDERS)

export function slugPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export function createDefaultCaptions(item: {
  campaign: string
  modelName: string
  feature: string
  productUrl: string
}): Record<Provider, CaptionSet> {
  const model = item.modelName
  const feature = item.feature
  const productUrl = item.productUrl
  const commonTags = item.campaign === 'artist-shorts'
    ? ['BellaraBrass', 'ArtistModel', 'Trumpet']
    : ['BellaraBrass', 'SignatureModel', 'Trumpet']
  const youtubeTags = [
    'Bellara Brass',
    `Bellara ${model}`,
    `${model} trumpet`,
    'trumpet',
    'Bb trumpet',
    'professional trumpet',
    feature,
    'brass instruments',
  ]

  return {
    facebook: {
      content: `${feature}, built into the Bellara ${model}.\n\nA detail chosen for players who notice feel, response, and finish before the first note settles.\n\nQuality craftsmanship you can see. And hear.\n\n#${commonTags.join(' #')}`,
      firstCommentText: productUrl,
    },
    instagram: {
      content: `${feature}, built into the Bellara ${model}.\n\nDesigned for the details players see, feel, and hear.\n\nQuality craftsmanship you can see. And hear.\n\n#${[...commonTags, 'TrumpetPlayer', 'BrassPlayer', 'BrassInstrument', 'TrumpetLife', 'MusiciansOfInstagram'].join(' #')}`,
    },
    youtube: {
      title: `${feature} | Bellara ${model} #Shorts`,
      content: `The Bellara ${model} features ${feature.toLowerCase()}.\n\nQuality craftsmanship you can see. And hear.\n\n${productUrl}\n\n#BellaraBrass #Trumpet #Shorts`,
      firstCommentText: productUrl,
      tags: youtubeTags,
    },
    tiktok: {
      title: feature.slice(0, 80),
      content: `${feature}.\n\nA small detail, until you play it.\n\n#BellaraBrass #TrumpetTok #Trumpet #BrassTok #MusicianTok`,
    },
  }
}

export function normalizeProvider(input: unknown): Provider | null {
  const value = String(input || '').trim()
  return PROVIDER_KEYS.has(value) ? value as Provider : null
}

export function normalizeStatus(input: unknown): WorkflowStatus {
  const value = String(input || '').trim()
  if (['needs_copy', 'ready_for_review', 'approved', 'drafted', 'scheduled', 'published'].includes(value)) {
    return value as WorkflowStatus
  }
  return 'needs_copy'
}

export function sanitizeCaption(input: unknown): CaptionSet {
  const raw = input && typeof input === 'object' ? input as Record<string, unknown> : {}
  return {
    content: String(raw.content || '').slice(0, 2800),
    firstCommentText: raw.firstCommentText ? String(raw.firstCommentText).slice(0, 1000) : '',
    title: raw.title ? String(raw.title).slice(0, 100) : '',
    tags: Array.isArray(raw.tags) ? raw.tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 25) : [],
  }
}

export function buildSplitDefinition(item: SocialVideoItem, providers: Provider[]) {
  return {
    business: item.business,
    mediaUrl: item.mediaUrl,
    posts: providers.map((network) => {
      const caption = item.captions[network]
      const post: {
        id?: number
        network: Provider
        content: string
        firstCommentText: string
        networkData: Record<string, unknown>
      } = {
        ...(item.draftIds?.[network] ? { id: item.draftIds[network] } : {}),
        network,
        content: caption.content,
        firstCommentText: caption.firstCommentText || '',
        networkData: {},
      }
      if (network === 'facebook') post.networkData = { type: 'REEL' }
      if (network === 'instagram') post.networkData = { type: 'REEL', showReelOnFeed: true }
      if (network === 'youtube') {
        post.networkData = {
          title: caption.title || `${item.feature} | Bellara ${item.modelName} #Shorts`,
          type: 'video',
          privacy: 'public',
          tags: caption.tags || [],
          category: 'ENTERTAINMENT',
          madeForKids: false,
        }
      }
      if (network === 'tiktok') post.networkData = { title: caption.title || item.feature.slice(0, 80) }
      return post
    }),
  }
}

export function buildSchedulePlan(items: SocialVideoItem[], input: Record<string, unknown>) {
  const campaign = String(input.campaign || 'all')
  const startDate = String(input.startDate || '')
  const time = String(input.time || '09:00:00')
  const networks = Array.isArray(input.networks)
    ? input.networks.map(normalizeProvider).filter((network): network is Provider => Boolean(network))
    : PROVIDERS.slice()
  if (!isValidDate(startDate)) throw new Error('startDate must be a real date in YYYY-MM-DD format.')
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(time)) throw new Error('time must be HH:mm or HH:mm:ss.')
  const timeParts = time.split(':').map(Number)
  const hours = timeParts[0] ?? 0
  const minutes = timeParts[1] ?? 0
  const seconds = timeParts[2] ?? 0
  if (hours > 23 || minutes > 59 || seconds > 59) throw new Error('time must be a valid 24-hour time.')
  if (networks.length === 0) throw new Error('Select at least one network.')
  const approved = items
    .filter((item) => campaign === 'all' || item.campaign === campaign)
    .filter((item) => ['approved', 'drafted'].includes(item.status))
    .sort((a, b) => a.campaign.localeCompare(b.campaign) || a.position - b.position)

  return approved.map((item, index) => {
    const date = new Date(`${startDate}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() + index)
    const ymd = date.toISOString().slice(0, 10)
    return {
      itemId: item.id,
      feature: item.feature,
      campaign: item.campaign,
      date: ymd,
      time,
      networks,
      posts: networks.map((network) => ({
        network,
        publicationDate: {
          dateTime: `${ymd}T${time}`,
          timezone: 'America/Chicago',
        },
        mediaUrl: item.mediaUrl,
        caption: item.captions[network],
      })),
    }
  })
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}
