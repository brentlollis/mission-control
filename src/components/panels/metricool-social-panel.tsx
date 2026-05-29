'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'

const PROVIDERS = ['facebook', 'instagram', 'youtube', 'tiktok'] as const
type Provider = typeof PROVIDERS[number]
type WorkflowStatus = 'needs_copy' | 'ready_for_review' | 'approved' | 'drafted' | 'scheduled' | 'published'

interface CaptionSet {
  content: string
  firstCommentText?: string
  title?: string
  tags?: string[]
}

interface SocialVideoItem {
  id: string
  business: string
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
  status: WorkflowStatus
  captions: Record<Provider, CaptionSet>
  draftIds: Partial<Record<Provider, number>>
  scheduledPosts: Partial<Record<Provider, number>>
  updatedAt?: string
}

interface ConnectionSnapshot {
  business: string
  displayName: string
  configuredDefaultProviders: Provider[]
  id: number
  userId: number
  label: string
  timezone: string
  connections: Record<Provider, string | null>
}

interface LibraryPost {
  id: number
  draft: boolean
  content: string
  firstCommentText?: string
  publishMode?: string
  media?: Array<{ id: number; position: number; url: string }>
  networks: Record<Provider, boolean>
  descendantsCount?: number
}

interface LibrarySnapshot {
  business: string
  displayName: string
  count: number
  posts: LibraryPost[]
}

interface BrandSnapshot {
  key: string
  displayName: string
  providers: ConnectionSnapshot | null
  library: LibrarySnapshot | null
  error: string | null
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

interface SchedulePlanEntry {
  itemId: string
  feature: string
  campaign: string
  date: string
  time: string
  networks: Provider[]
  posts: Array<{
    network: Provider
    publicationDate: { dateTime: string; timezone: string }
    mediaUrl: string
    caption: CaptionSet
  }>
}

interface DashboardResponse {
  generatedAt: string
  providers: Provider[]
  businesses: Array<{ key: string; displayName: string }>
  brands: BrandSnapshot[]
  inventory: SocialVideoItem[]
  audit: AuditEntry[]
}

const providerLabels: Record<Provider, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
}

const statusLabels: Record<WorkflowStatus, string> = {
  needs_copy: 'Needs copy',
  ready_for_review: 'Ready for review',
  approved: 'Approved',
  drafted: 'Drafted',
  scheduled: 'Scheduled',
  published: 'Published',
}

const defaultNetworks = PROVIDERS.reduce((acc, provider) => {
  acc[provider] = true
  return acc
}, {} as Record<Provider, boolean>)

function defaultStartDate() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return date.toISOString().slice(0, 10)
}

export function MetricoolSocialPanel() {
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [selectedBrand, setSelectedBrand] = useState('bellara-brass')
  const [selectedItemId, setSelectedItemId] = useState<string>('')
  const [selectedProvider, setSelectedProvider] = useState<Provider>('facebook')
  const [selectedPostIds, setSelectedPostIds] = useState<Record<string, string[]>>({})
  const [draftNetworks, setDraftNetworks] = useState<Record<Provider, boolean>>(defaultNetworks)
  const [scheduleNetworks, setScheduleNetworks] = useState<Record<Provider, boolean>>(defaultNetworks)
  const [captionDrafts, setCaptionDrafts] = useState<Record<Provider, CaptionSet> | null>(null)
  const [statusDraft, setStatusDraft] = useState<WorkflowStatus>('needs_copy')
  const [scheduleCampaign, setScheduleCampaign] = useState('all')
  const [scheduleDate, setScheduleDate] = useState(defaultStartDate)
  const [scheduleTime, setScheduleTime] = useState('09:00:00')
  const [schedulePlan, setSchedulePlan] = useState<SchedulePlanEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null)

  const loadDashboard = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/local/metricool-social', { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Failed to load Metricool dashboard')
      setData(json as DashboardResponse)
    } catch (err: any) {
      setError(err?.message || 'Failed to load Metricool dashboard')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const activeBrand = useMemo(() => {
    return data?.brands.find((brand) => brand.key === selectedBrand) || data?.brands[0] || null
  }, [data, selectedBrand])

  const bellaraItems = useMemo(() => {
    return (data?.inventory || []).filter((item) => item.business === 'bellara-brass')
  }, [data])

  const selectedItem = useMemo(() => {
    return bellaraItems.find((item) => item.id === selectedItemId) || bellaraItems[0] || null
  }, [bellaraItems, selectedItemId])

  useEffect(() => {
    if (selectedItem && selectedItem.id !== selectedItemId) setSelectedItemId(selectedItem.id)
  }, [selectedItem, selectedItemId])

  useEffect(() => {
    if (!selectedItem) return
    setCaptionDrafts(JSON.parse(JSON.stringify(selectedItem.captions)))
    setStatusDraft(selectedItem.status)
  }, [selectedItem])

  const activePosts = activeBrand?.library?.posts || []
  const activeSelectedIds = selectedPostIds[activeBrand?.key || ''] || []
  const selectedCaption = captionDrafts?.[selectedProvider] || { content: '' }
  const selectedDraftNetworks = PROVIDERS.filter((provider) => draftNetworks[provider])
  const selectedScheduleNetworks = PROVIDERS.filter((provider) => scheduleNetworks[provider])
  const draftCount = data?.brands.reduce((sum, brand) => {
    return sum + (brand.library?.posts.filter((post) => post.draft).length || 0)
  }, 0) || 0
  const connectedCount = data?.brands.reduce((sum, brand) => {
    const connections = brand.providers?.connections
    return sum + (connections ? PROVIDERS.filter((provider) => Boolean(connections[provider])).length : 0)
  }, 0) || 0
  const approvedCount = bellaraItems.filter((item) => ['approved', 'drafted', 'scheduled', 'published'].includes(item.status)).length
  const draftedCount = bellaraItems.filter((item) => item.status === 'drafted').length
  const campaigns = Array.from(new Set(bellaraItems.map((item) => item.campaign)))

  function updateCaption(provider: Provider, patch: Partial<CaptionSet>) {
    setCaptionDrafts((current) => {
      if (!current) return current
      return { ...current, [provider]: { ...current[provider], ...patch } }
    })
  }

  function updateTags(value: string) {
    updateCaption(selectedProvider, {
      tags: value.split(',').map((tag) => tag.trim()).filter(Boolean),
    })
  }

  function toggleNetwork(
    provider: Provider,
    setter: (value: React.SetStateAction<Record<Provider, boolean>>) => void
  ) {
    setter((current) => ({ ...current, [provider]: !current[provider] }))
  }

  async function postAction(body: Record<string, unknown>, busyLabel: string) {
    setBusyAction(busyLabel)
    setFeedback(null)
    try {
      const res = await fetch('/api/local/metricool-social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Metricool action failed')
      if (json?.audit && data) setData({ ...data, audit: json.audit })
      return json
    } catch (err: any) {
      setFeedback({ ok: false, text: err?.message || 'Metricool action failed' })
      throw err
    } finally {
      setBusyAction(null)
    }
  }

  async function saveSelected() {
    if (!selectedItem || !captionDrafts) return
    const json = await postAction({
      action: 'save_item',
      itemId: selectedItem.id,
      status: statusDraft,
      captions: captionDrafts,
    }, 'save')
    setFeedback({ ok: true, text: 'Saved local captions and workflow status.' })
    if (json?.item && data) {
      setData({
        ...data,
        inventory: data.inventory.map((item) => item.id === json.item.id ? json.item : item),
        audit: json.audit || data.audit,
      })
    }
  }

  async function createDrafts(dryRun: boolean) {
    if (!selectedItem || !captionDrafts) return
    if (selectedDraftNetworks.length === 0) {
      setFeedback({ ok: false, text: 'Select at least one network for draft creation.' })
      return
    }
    if (!dryRun) {
      const confirmed = window.confirm('Create visible Metricool Posts Library drafts for the selected networks?')
      if (!confirmed) return
    }
    const json = await postAction({
      action: 'create_drafts',
      itemId: selectedItem.id,
      networks: selectedDraftNetworks,
      captions: captionDrafts,
      status: statusDraft,
      dryRun,
    }, dryRun ? 'draft-dry-run' : 'create-drafts')
    setFeedback({
      ok: true,
      text: dryRun
        ? `Dry run prepared ${selectedDraftNetworks.length} split draft payloads.`
        : `Created Metricool drafts for ${selectedDraftNetworks.length} network${selectedDraftNetworks.length === 1 ? '' : 's'}.`,
    })
    if (!dryRun) await loadDashboard(true)
  }

  async function planSchedule() {
    if (selectedScheduleNetworks.length === 0) {
      setFeedback({ ok: false, text: 'Select at least one network for the schedule plan.' })
      return
    }
    const json = await postAction({
      action: 'schedule_plan',
      campaign: scheduleCampaign,
      startDate: scheduleDate,
      time: scheduleTime,
      networks: selectedScheduleNetworks,
    }, 'schedule-plan')
    setSchedulePlan(json.plan || [])
    setFeedback({ ok: true, text: `Generated a dry-run schedule for ${(json.plan || []).length} approved videos.` })
    if (json?.audit && data) setData({ ...data, audit: json.audit })
  }

  function togglePost(brandKey: string, id: number) {
    const postId = String(id)
    setSelectedPostIds((current) => {
      const existing = current[brandKey] || []
      const next = existing.includes(postId)
        ? existing.filter((value) => value !== postId)
        : [...existing, postId]
      return { ...current, [brandKey]: next }
    })
  }

  async function verifyPosts(brandKey: string, ids: string[]) {
    if (ids.length === 0) return
    const json = await postAction({ action: 'verify', business: brandKey, ids }, 'verify')
    setFeedback({ ok: true, text: `Verified ${ids.length} post${ids.length === 1 ? '' : 's'} in Metricool.` })
    if (json?.audit && data) setData({ ...data, audit: json.audit })
    await loadDashboard(true)
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-muted-foreground">Loading Metricool social workspace</span>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground">Metricool Social</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Bellara short-form inventory, platform copy, review drafts, and daily schedule planning.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusPill ok={Boolean(data)} label={data ? 'Agent linked' : 'Agent unavailable'} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadDashboard(true)}
            disabled={refreshing}
            title="Refresh Metricool state"
          >
            {refreshing ? <SpinnerIcon /> : <RefreshIcon />}
            Refresh
          </Button>
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-xs text-destructive">
          {error}
        </div>
      )}

      {feedback && (
        <div className={`rounded-lg px-4 py-3 text-xs font-medium ${
          feedback.ok ? 'bg-green-500/10 text-green-400' : 'bg-destructive/10 text-destructive'
        }`}>
          {feedback.text}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
        <Metric label="Videos" value={String(bellaraItems.length)} />
        <Metric label="Approved" value={String(approvedCount)} />
        <Metric label="Drafted" value={String(draftedCount)} />
        <Metric label="Library Drafts" value={String(draftCount)} />
        <Metric label="Profiles" value={`${connectedCount}/${(data?.brands.length || 0) * PROVIDERS.length}`} />
        <Metric label="Refresh" value={data?.generatedAt ? new Date(data.generatedAt).toLocaleTimeString() : '-'} />
      </div>

      <section className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-sm font-medium text-foreground">Brand Connections</h3>
            <p className="text-2xs text-muted-foreground mt-0.5">Metricool provider status across reusable brands.</p>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto">
            {data?.brands.map((brand) => (
              <Button
                key={brand.key}
                variant={selectedBrand === brand.key ? 'default' : 'outline'}
                size="xs"
                onClick={() => setSelectedBrand(brand.key)}
                className="shrink-0"
              >
                {brand.displayName}
              </Button>
            ))}
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-0 border-b border-border/60">
          {data?.brands.map((brand) => (
            <div key={brand.key} className="px-4 py-3 border-b md:border-b-0 md:border-r last:border-r-0 border-border/60">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-medium text-foreground truncate">{brand.displayName}</div>
                <span className="text-2xs text-muted-foreground font-mono">{brand.providers?.timezone || '-'}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PROVIDERS.map((provider) => (
                  <ConnectionBadge
                    key={provider}
                    label={providerLabels[provider]}
                    value={brand.providers?.connections?.[provider] || null}
                  />
                ))}
              </div>
              {brand.error && <div className="text-2xs text-amber-400 mt-2 truncate">{brand.error}</div>}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-foreground">Bellara Publishing Cockpit</h3>
            <p className="text-2xs text-muted-foreground mt-0.5">Autolist inventory staged for platform-specific Posts Library drafts.</p>
          </div>
          <StatusPill ok={approvedCount > 0} label={`${approvedCount} approved`} />
        </div>

        <div className="grid lg:grid-cols-[360px_minmax(0,1fr)] min-h-[580px]">
          <div className="border-b lg:border-b-0 lg:border-r border-border overflow-hidden">
            <div className="px-4 py-2 border-b border-border/60 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Inventory</span>
              <span className="text-2xs text-muted-foreground">{bellaraItems.length} videos</span>
            </div>
            <div className="max-h-[720px] overflow-y-auto">
              {bellaraItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedItemId(item.id)}
                  className={`w-full px-4 py-3 text-left border-b border-border/50 hover:bg-secondary/50 ${
                    selectedItem?.id === item.id ? 'bg-secondary' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-foreground truncate">{item.feature}</div>
                      <div className="text-2xs text-muted-foreground mt-0.5">
                        {item.campaignName} · #{item.position}
                      </div>
                    </div>
                    <StatusDot status={item.status} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {PROVIDERS.map((provider) => (
                      <span
                        key={provider}
                        className={`text-2xs px-1.5 py-0.5 rounded ${
                          item.draftIds?.[provider]
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {providerLabels[provider]}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
              {bellaraItems.length === 0 && (
                <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                  No Bellara short-form inventory found.
                </div>
              )}
            </div>
          </div>

          <div className="p-4 space-y-4">
            {selectedItem && captionDrafts ? (
              <>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <h4 className="text-base font-semibold text-foreground truncate">{selectedItem.feature}</h4>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      <span>{selectedItem.modelName}</span>
                      <span>Autolist {selectedItem.autolistId}</span>
                      <span>Post {selectedItem.autolistPostId}</span>
                      <a className="text-primary hover:underline truncate max-w-[360px]" href={selectedItem.mediaUrl} target="_blank" rel="noopener noreferrer">
                        {selectedItem.fileName}
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={statusDraft}
                      onChange={(event) => setStatusDraft(event.target.value as WorkflowStatus)}
                      className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
                    >
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                    <Button size="sm" onClick={saveSelected} disabled={busyAction === 'save'}>
                      {busyAction === 'save' ? <SpinnerIcon /> : <SaveIcon />}
                      Save
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="px-3 py-2 border-b border-border flex items-center gap-2 overflow-x-auto">
                    {PROVIDERS.map((provider) => (
                      <Button
                        key={provider}
                        size="xs"
                        variant={selectedProvider === provider ? 'default' : 'outline'}
                        onClick={() => setSelectedProvider(provider)}
                        className="shrink-0"
                      >
                        {providerLabels[provider]}
                        {selectedItem.draftIds?.[provider] && (
                          <span className="text-2xs opacity-70">#{selectedItem.draftIds[provider]}</span>
                        )}
                      </Button>
                    ))}
                  </div>
                  <div className="p-3 space-y-3">
                    {(selectedProvider === 'youtube' || selectedProvider === 'tiktok') && (
                      <label className="block">
                        <span className="text-2xs uppercase tracking-wider text-muted-foreground">Title</span>
                        <input
                          value={selectedCaption.title || ''}
                          onChange={(event) => updateCaption(selectedProvider, { title: event.target.value })}
                          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground"
                        />
                      </label>
                    )}
                    <label className="block">
                      <span className="text-2xs uppercase tracking-wider text-muted-foreground">Caption</span>
                      <textarea
                        value={selectedCaption.content || ''}
                        onChange={(event) => updateCaption(selectedProvider, { content: event.target.value })}
                        className="mt-1 min-h-[170px] w-full rounded-md border border-border bg-background px-3 py-2 text-xs leading-relaxed text-foreground resize-y"
                      />
                    </label>
                    {(selectedProvider === 'facebook' || selectedProvider === 'youtube') && (
                      <label className="block">
                        <span className="text-2xs uppercase tracking-wider text-muted-foreground">First Comment</span>
                        <textarea
                          value={selectedCaption.firstCommentText || ''}
                          onChange={(event) => updateCaption(selectedProvider, { firstCommentText: event.target.value })}
                          className="mt-1 min-h-[70px] w-full rounded-md border border-border bg-background px-3 py-2 text-xs leading-relaxed text-foreground resize-y"
                        />
                      </label>
                    )}
                    {selectedProvider === 'youtube' && (
                      <label className="block">
                        <span className="text-2xs uppercase tracking-wider text-muted-foreground">YouTube Tags</span>
                        <input
                          value={(selectedCaption.tags || []).join(', ')}
                          onChange={(event) => updateTags(event.target.value)}
                          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground"
                        />
                      </label>
                    )}
                  </div>
                </div>

                <div className="grid lg:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h5 className="text-xs font-medium text-foreground">Posts Library Drafts</h5>
                        <p className="text-2xs text-muted-foreground mt-0.5">One first-class draft per selected network.</p>
                      </div>
                      <NetworkSelector networks={draftNetworks} onToggle={(provider) => toggleNetwork(provider, setDraftNetworks)} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="outline" size="xs" onClick={() => createDrafts(true)} disabled={Boolean(busyAction)}>
                        {busyAction === 'draft-dry-run' ? <SpinnerIcon /> : <PreviewIcon />}
                        Dry run
                      </Button>
                      <Button size="xs" onClick={() => createDrafts(false)} disabled={Boolean(busyAction) || statusDraft !== 'approved'}>
                        {busyAction === 'create-drafts' ? <SpinnerIcon /> : <LibraryIcon />}
                        Create drafts
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border p-3">
                    <h5 className="text-xs font-medium text-foreground">Draft IDs</h5>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {PROVIDERS.map((provider) => (
                        <div key={provider} className="text-xs flex items-center justify-between gap-2 rounded border border-border/70 px-2 py-1.5">
                          <span className="text-muted-foreground">{providerLabels[provider]}</span>
                          <span className="font-mono text-foreground">{selectedItem.draftIds?.[provider] || '-'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-16 text-center text-xs text-muted-foreground">Select a Bellara video.</div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-sm font-medium text-foreground">Daily Schedule Planner</h3>
            <p className="text-2xs text-muted-foreground mt-0.5">Dry-run plan only. Approved and drafted videos are eligible.</p>
          </div>
          <NetworkSelector networks={scheduleNetworks} onToggle={(provider) => toggleNetwork(provider, setScheduleNetworks)} />
        </div>
        <div className="p-4 space-y-4">
          <div className="grid sm:grid-cols-[1fr_160px_130px_auto] gap-2">
            <select
              value={scheduleCampaign}
              onChange={(event) => setScheduleCampaign(event.target.value)}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
            >
              <option value="all">All Bellara shorts</option>
              {campaigns.map((campaign) => (
                <option key={campaign} value={campaign}>{campaign}</option>
              ))}
            </select>
            <input
              type="date"
              value={scheduleDate}
              onChange={(event) => setScheduleDate(event.target.value)}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
            />
            <input
              type="time"
              step="1"
              value={scheduleTime}
              onChange={(event) => setScheduleTime(event.target.value)}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
            />
            <Button size="sm" onClick={planSchedule} disabled={busyAction === 'schedule-plan'}>
              {busyAction === 'schedule-plan' ? <SpinnerIcon /> : <CalendarIcon />}
              Plan
            </Button>
          </div>

          {schedulePlan.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs min-w-[760px]">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left px-3 py-2 font-medium">Date</th>
                    <th className="text-left px-3 py-2 font-medium">Video</th>
                    <th className="text-left px-3 py-2 font-medium">Campaign</th>
                    <th className="text-left px-3 py-2 font-medium">Networks</th>
                  </tr>
                </thead>
                <tbody>
                  {schedulePlan.map((entry) => (
                    <tr key={entry.itemId} className="border-b border-border/50">
                      <td className="px-3 py-2 font-mono text-muted-foreground">{entry.date} {entry.time}</td>
                      <td className="px-3 py-2 text-foreground">{entry.feature}</td>
                      <td className="px-3 py-2 text-muted-foreground">{entry.campaign}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {entry.networks.map((network) => (
                            <span key={network} className="px-1.5 py-0.5 rounded bg-secondary text-muted-foreground text-2xs">
                              {providerLabels[network]}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
              No schedule plan generated.
            </div>
          )}
        </div>
      </section>

      <PostsLibrarySection
        brands={data?.brands || []}
        selectedBrand={selectedBrand}
        setSelectedBrand={setSelectedBrand}
        activeBrand={activeBrand}
        activePosts={activePosts}
        selectedIds={activeSelectedIds}
        togglePost={togglePost}
        selectAll={() => activeBrand && setSelectedPostIds((current) => ({
          ...current,
          [activeBrand.key]: activePosts.map((post) => String(post.id)),
        }))}
        clearSelection={() => activeBrand && setSelectedPostIds((current) => ({ ...current, [activeBrand.key]: [] }))}
        verifyPosts={verifyPosts}
        busy={busyAction === 'verify'}
      />

      <RunLog audit={data?.audit || []} />
    </div>
  )
}

function PostsLibrarySection({
  brands,
  selectedBrand,
  setSelectedBrand,
  activeBrand,
  activePosts,
  selectedIds,
  togglePost,
  selectAll,
  clearSelection,
  verifyPosts,
  busy,
}: {
  brands: BrandSnapshot[]
  selectedBrand: string
  setSelectedBrand: (brand: string) => void
  activeBrand: BrandSnapshot | null
  activePosts: LibraryPost[]
  selectedIds: string[]
  togglePost: (brandKey: string, id: number) => void
  selectAll: () => void
  clearSelection: () => void
  verifyPosts: (brandKey: string, ids: string[]) => void
  busy: boolean
}) {
  return (
    <section className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-sm font-medium text-foreground">Posts Library Review</h3>
          <p className="text-2xs text-muted-foreground mt-0.5">Visible Metricool drafts grouped by brand.</p>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto">
          {brands.map((brand) => (
            <Button
              key={brand.key}
              variant={selectedBrand === brand.key ? 'default' : 'outline'}
              size="xs"
              onClick={() => setSelectedBrand(brand.key)}
              className="shrink-0"
            >
              {brand.displayName}
              <span className="ml-1 text-2xs opacity-70">{brand.library?.count || 0}</span>
            </Button>
          ))}
        </div>
      </div>

      <div className="px-4 py-3 border-b border-border/60 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="text-xs text-muted-foreground">
          {activeBrand?.displayName || 'No brand selected'} · {activePosts.length} draft{activePosts.length === 1 ? '' : 's'} · {selectedIds.length} selected
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="xs" onClick={selectAll} disabled={activePosts.length === 0}>Select all</Button>
          <Button variant="outline" size="xs" onClick={clearSelection} disabled={selectedIds.length === 0}>Clear</Button>
          <Button
            size="xs"
            onClick={() => activeBrand && verifyPosts(activeBrand.key, selectedIds)}
            disabled={!activeBrand || selectedIds.length === 0 || busy}
          >
            {busy ? <SpinnerIcon /> : <CheckIcon />}
            Verify selected
          </Button>
        </div>
      </div>

      {activeBrand?.error && (
        <div className="px-4 py-3 border-b border-border/60 bg-amber-500/5 text-xs text-amber-400">
          {activeBrand.error}
        </div>
      )}

      {activePosts.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[960px]">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="w-10 px-4 py-2" />
                <th className="text-left px-2 py-2 font-medium">ID</th>
                <th className="text-left px-2 py-2 font-medium">Network</th>
                <th className="text-left px-2 py-2 font-medium">Caption</th>
                <th className="text-left px-2 py-2 font-medium">First Comment</th>
                <th className="text-left px-2 py-2 font-medium">Media</th>
              </tr>
            </thead>
            <tbody>
              {activePosts.map((post) => {
                const selected = selectedIds.includes(String(post.id))
                const networks = PROVIDERS.filter((provider) => post.networks?.[provider])
                return (
                  <tr key={post.id} className="border-b border-border/50 align-top hover:bg-secondary/40">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => activeBrand && togglePost(activeBrand.key, post.id)}
                        className="w-3.5 h-3.5 rounded accent-primary"
                        aria-label={`Select post ${post.id}`}
                      />
                    </td>
                    <td className="px-2 py-3 font-mono text-muted-foreground">{post.id}</td>
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[150px]">
                        {networks.map((network) => (
                          <span key={network} className="px-1.5 py-0.5 rounded bg-secondary text-muted-foreground text-2xs">
                            {providerLabels[network]}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-2 py-3 max-w-[340px]">
                      <div className="max-h-20 overflow-hidden text-foreground leading-relaxed whitespace-pre-wrap">
                        {post.content || '-'}
                      </div>
                    </td>
                    <td className="px-2 py-3 max-w-[220px]">
                      <div className="max-h-16 overflow-hidden text-muted-foreground whitespace-pre-wrap">
                        {post.firstCommentText || '-'}
                      </div>
                    </td>
                    <td className="px-2 py-3 max-w-[220px]">
                      <div className="space-y-1">
                        {(post.media || []).map((media) => (
                          <a
                            key={media.id}
                            href={media.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block truncate font-mono text-2xs text-primary hover:underline"
                            title={media.url}
                          >
                            {media.url.split('/').pop() || media.url}
                          </a>
                        ))}
                        {(post.media || []).length === 0 && <span className="text-muted-foreground">-</span>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-4 py-8 text-center text-xs text-muted-foreground">
          No library drafts returned for this brand.
        </div>
      )}
    </section>
  )
}

function RunLog({ audit }: { audit: AuditEntry[] }) {
  return (
    <section className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Run Log</h3>
        <span className="text-2xs text-muted-foreground">Local JSONL audit, newest first</span>
      </div>
      {audit.length > 0 ? (
        <div className="divide-y divide-border/50">
          {audit.map((entry, index) => (
            <div key={`${entry.timestamp}-${index}`} className="px-4 py-2.5 grid grid-cols-1 md:grid-cols-[180px_120px_1fr_90px] gap-2 text-xs">
              <div className="font-mono text-muted-foreground">{new Date(entry.timestamp).toLocaleString()}</div>
              <div className={entry.ok ? 'text-green-400' : 'text-destructive'}>{entry.action}</div>
              <div className="min-w-0">
                <span className="text-foreground">{entry.business || 'workspace'}</span>
                {entry.itemId && <span className="text-muted-foreground ml-2 font-mono truncate">{entry.itemId}</span>}
                {entry.ids && entry.ids.length > 0 && (
                  <span className="text-muted-foreground ml-2 font-mono truncate">#{entry.ids.join(', #')}</span>
                )}
                {entry.error && <div className="text-destructive mt-0.5 truncate">{entry.error}</div>}
              </div>
              <div className="text-muted-foreground md:text-right">{entry.durationMs} ms</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-4 py-6 text-center text-xs text-muted-foreground">
          No local Metricool actions logged yet.
        </div>
      )}
    </section>
  )
}

function NetworkSelector({
  networks,
  onToggle,
}: {
  networks: Record<Provider, boolean>
  onToggle: (provider: Provider) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PROVIDERS.map((provider) => (
        <button
          key={provider}
          onClick={() => onToggle(provider)}
          className={`h-7 rounded border px-2 text-2xs font-medium transition-colors ${
            networks[provider]
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-border bg-background text-muted-foreground hover:text-foreground'
          }`}
          type="button"
        >
          {providerLabels[provider]}
        </button>
      ))}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <div className="text-2xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold text-foreground mt-0.5 truncate">{value}</div>
    </div>
  )
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`text-2xs px-2 py-1 rounded flex items-center gap-1.5 ${
      ok ? 'bg-green-500/10 text-green-400' : 'bg-destructive/10 text-destructive'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-green-500' : 'bg-destructive'}`} />
      {label}
    </span>
  )
}

function StatusDot({ status }: { status: WorkflowStatus }) {
  const ready = ['approved', 'drafted', 'scheduled', 'published'].includes(status)
  return (
    <span className={`text-2xs px-1.5 py-0.5 rounded shrink-0 ${
      ready ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'
    }`}>
      {statusLabels[status]}
    </span>
  )
}

function ConnectionBadge({ label, value }: { label: string; value: string | null }) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded px-1.5 py-0.5 text-2xs ${
        value ? 'bg-green-500/10 text-green-400' : 'bg-muted text-muted-foreground'
      }`}
      title={value || `${label} not connected`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${value ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
      <span className="truncate">{label}</span>
    </span>
  )
}

function SpinnerIcon() {
  return <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
}

function RefreshIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 8a6 6 0 0110.5-4" />
      <path d="M12.5 2.5v3.5H9" />
      <path d="M14 8a6 6 0 01-10.5 4" />
      <path d="M3.5 13.5V10H7" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 4L6 11 3 8" />
    </svg>
  )
}

function SaveIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2.5h8l2 2v9H3z" />
      <path d="M5 2.5v4h6v-4" />
      <path d="M5 13.5v-4h6v4" />
    </svg>
  )
}

function PreviewIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 8s2.4-4 6.5-4 6.5 4 6.5 4-2.4 4-6.5 4-6.5-4-6.5-4z" />
      <circle cx="8" cy="8" r="1.8" />
    </svg>
  )
}

function LibraryIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h10v10H3z" />
      <path d="M5.5 6h5" />
      <path d="M5.5 8h5" />
      <path d="M5.5 10h3" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v3" />
      <path d="M12 2v3" />
      <path d="M2.5 5h11" />
      <path d="M3 3.5h10a1 1 0 011 1V13a1 1 0 01-1 1H3a1 1 0 01-1-1V4.5a1 1 0 011-1z" />
    </svg>
  )
}
