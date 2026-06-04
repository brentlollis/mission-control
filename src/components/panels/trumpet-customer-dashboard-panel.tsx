'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'

interface CustomerRow {
  id: number
  display_name: string
  primary_email?: string
  primary_phone?: string
  transaction_count: number
  shipment_count: number
  last_activity_at?: string
}

interface ShipmentRow {
  id: number
  customer_name?: string
  business?: string
  carrier?: string
  service?: string
  tracking_number?: string
  tracking_status?: string
  label_transaction_id?: string
  shipment_date?: string
  amount?: number
  currency?: string
}

interface TransactionRow {
  id: number
  customer_name?: string
  business?: string
  source: string
  source_id: string
  transaction_type: string
  occurred_at?: string
  status?: string
  title?: string
  amount?: number
  currency?: string
}

interface TransactionItemRow {
  id: number
  customer_name?: string
  source: string
  source_item_id: string
  platform_listing_id?: string
  sku?: string
  serial_number?: string
  title?: string
  brand?: string
  model?: string
  quantity?: number
  unit_amount?: number
  total_amount?: number
  currency?: string
}

interface InventoryItemRow {
  id: number
  business?: string
  status?: string
  brand?: string
  model?: string
  serial_number?: string
  sku?: string
  title?: string
  year?: string
  owned?: number
  asking_price?: number
  currency?: string
  ecwid_status?: string
  reverb_status?: string
  ebay_status?: string
  match_evidence?: string
  listing_count?: number
}

interface SoldItemRow {
  id: number
  source: string
  source_sale_id: string
  source_item_id: string
  sold_at?: string
  title?: string
  sku?: string
  serial_number?: string
  amount?: number
  currency?: string
  status?: string
  customer_name?: string
  brand?: string
  model?: string
  tracking_number?: string
}

interface SourceRow {
  source: string
  source_kind: string
  count: number
  last_imported_at?: string
}

interface DashboardResponse {
  ok: boolean
  generatedAt: string
  dashboardUrl: string
  dbPath: string
  error?: string
  customerCount: number
  shipmentCount: number
  transactionCount: number
  transactionItemCount: number
  instrumentCount: number
  inventoryCount: number
  activeListingCount: number
  soldItemCount: number
  sourceRecordCount: number
  customers: CustomerRow[]
  inventoryItems: InventoryItemRow[]
  soldItems: SoldItemRow[]
  transactions: TransactionRow[]
  transactionItems: TransactionItemRow[]
  shipments: ShipmentRow[]
  sources: SourceRow[]
}

export function TrumpetCustomerDashboardPanel() {
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadDashboard = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/local/trumpet-customer-dashboard', { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Failed to load customer dashboard')
      setData(json as DashboardResponse)
    } catch (err: any) {
      setError(err?.message || 'Failed to load customer dashboard')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const sourceLabel = useMemo(() => {
    if (!data?.sources?.length) return 'No imports'
    return data.sources.map((source) => `${source.source}:${source.source_kind} (${source.count})`).join(', ')
  }, [data])

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-muted-foreground">Loading customer dashboard</span>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground">Trumpet Customers</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Heritage and Bellara customers linked across Shippo, marketplaces, stores, and spreadsheet imports.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusPill ok={Boolean(data?.ok)} label={data?.ok ? 'Database linked' : 'Database unavailable'} />
          {data?.dashboardUrl && (
            <Button variant="outline" size="sm" asChild title="Open the standalone local dashboard">
              <a href={data.dashboardUrl} target="_blank" rel="noopener noreferrer">
                <ExternalIcon />
                Open
              </a>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadDashboard(true)}
            disabled={refreshing}
            title="Refresh customer dashboard state"
          >
            {refreshing ? <SpinnerIcon /> : <RefreshIcon />}
            Refresh
          </Button>
        </div>
      </header>

      {(error || data?.error) && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-xs text-destructive">
          {error || data?.error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
        <Metric label="Customers" value={String(data?.customerCount || 0)} />
        <Metric label="Transactions" value={String(data?.transactionCount || 0)} />
        <Metric label="Inventory" value={String(data?.inventoryCount || 0)} />
        <Metric label="Sold Items" value={String(data?.soldItemCount || 0)} />
        <Metric label="Shipments" value={String(data?.shipmentCount || 0)} />
        <Metric label="Active Listings" value={String(data?.activeListingCount || 0)} />
      </div>

      <section className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex flex-col gap-1">
          <h3 className="text-sm font-medium text-foreground">Import Sources</h3>
          <p className="text-2xs text-muted-foreground truncate" title={sourceLabel}>{sourceLabel}</p>
        </div>
        {data?.sources?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[640px]">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left px-3 py-2 font-medium">Source</th>
                  <th className="text-left px-3 py-2 font-medium">Kind</th>
                  <th className="text-left px-3 py-2 font-medium">Rows</th>
                  <th className="text-left px-3 py-2 font-medium">Last Import</th>
                </tr>
              </thead>
              <tbody>
                {data.sources.map((source) => (
                  <tr key={`${source.source}-${source.source_kind}`} className="border-b border-border/50">
                    <td className="px-3 py-2 text-foreground">{source.source}</td>
                    <td className="px-3 py-2 text-muted-foreground">{source.source_kind}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{source.count}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatDate(source.last_imported_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState text="No imported source rows yet." />
        )}
      </section>

      <section className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-foreground">Customers</h3>
        </div>
        {data?.customers?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[860px]">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left px-3 py-2 font-medium">Name</th>
                  <th className="text-left px-3 py-2 font-medium">Email</th>
                  <th className="text-left px-3 py-2 font-medium">Phone</th>
                  <th className="text-left px-3 py-2 font-medium">Transactions</th>
                  <th className="text-left px-3 py-2 font-medium">Shipments</th>
                  <th className="text-left px-3 py-2 font-medium">Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {data.customers.map((customer) => (
                  <tr key={customer.id} className="border-b border-border/50 hover:bg-secondary/40">
                    <td className="px-3 py-2 text-foreground font-medium">{customer.display_name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{customer.primary_email || '-'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{customer.primary_phone || '-'}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{customer.transaction_count || 0}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{customer.shipment_count || 0}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatDate(customer.last_activity_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState text="No customers imported yet." />
        )}
      </section>

      <section className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-foreground">Inventory</h3>
        </div>
        {data?.inventoryItems?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[980px]">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left px-3 py-2 font-medium">Item</th>
                  <th className="text-left px-3 py-2 font-medium">Serial</th>
                  <th className="text-left px-3 py-2 font-medium">Price</th>
                  <th className="text-left px-3 py-2 font-medium">Ecwid</th>
                  <th className="text-left px-3 py-2 font-medium">Reverb</th>
                  <th className="text-left px-3 py-2 font-medium">eBay</th>
                  <th className="text-left px-3 py-2 font-medium">Match</th>
                </tr>
              </thead>
              <tbody>
                {data.inventoryItems.map((item) => (
                  <tr key={item.id} className="border-b border-border/50 hover:bg-secondary/40">
                    <td className="px-3 py-2 text-foreground font-medium">{itemName(item)}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{item.serial_number || '-'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatMoney(item.asking_price, item.currency)}</td>
                    <td className="px-3 py-2">{channelPill(item.ecwid_status)}</td>
                    <td className="px-3 py-2">{channelPill(item.reverb_status)}</td>
                    <td className="px-3 py-2">{channelPill(item.ebay_status)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatMatchEvidence(item.match_evidence)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState text="No inventory items imported yet." />
        )}
      </section>

      <section className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-foreground">Sold Items</h3>
        </div>
        {data?.soldItems?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[980px]">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left px-3 py-2 font-medium">Source</th>
                  <th className="text-left px-3 py-2 font-medium">Customer</th>
                  <th className="text-left px-3 py-2 font-medium">Item</th>
                  <th className="text-left px-3 py-2 font-medium">Sold</th>
                  <th className="text-left px-3 py-2 font-medium">Amount</th>
                  <th className="text-left px-3 py-2 font-medium">Tracking</th>
                </tr>
              </thead>
              <tbody>
                {data.soldItems.map((item) => (
                  <tr key={item.id} className="border-b border-border/50 hover:bg-secondary/40">
                    <td className="px-3 py-2 text-muted-foreground">{item.source}</td>
                    <td className="px-3 py-2 text-foreground font-medium">{item.customer_name || '-'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{itemName(item)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatDate(item.sold_at)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatMoney(item.amount, item.currency)}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{item.tracking_number || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState text="No sold items imported yet." />
        )}
      </section>

      <section className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-foreground">Recent Transactions</h3>
        </div>
        {data?.transactions?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[980px]">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left px-3 py-2 font-medium">Customer</th>
                  <th className="text-left px-3 py-2 font-medium">Source</th>
                  <th className="text-left px-3 py-2 font-medium">Type</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                  <th className="text-left px-3 py-2 font-medium">Title</th>
                  <th className="text-left px-3 py-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-border/50 hover:bg-secondary/40">
                    <td className="px-3 py-2 text-foreground font-medium">{transaction.customer_name || '-'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{transaction.source}</td>
                    <td className="px-3 py-2 text-muted-foreground">{transaction.transaction_type}</td>
                    <td className="px-3 py-2"><StatusPill ok label={transaction.status || 'Imported'} /></td>
                    <td className="px-3 py-2 text-muted-foreground">{transaction.title || '-'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatMoney(transaction.amount, transaction.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState text="No transactions imported yet." />
        )}
      </section>

      <section className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-foreground">Recent Items</h3>
        </div>
        {data?.transactionItems?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[980px]">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left px-3 py-2 font-medium">Customer</th>
                  <th className="text-left px-3 py-2 font-medium">Source</th>
                  <th className="text-left px-3 py-2 font-medium">SKU</th>
                  <th className="text-left px-3 py-2 font-medium">Serial</th>
                  <th className="text-left px-3 py-2 font-medium">Title</th>
                  <th className="text-left px-3 py-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.transactionItems.map((item) => (
                  <tr key={item.id} className="border-b border-border/50 hover:bg-secondary/40">
                    <td className="px-3 py-2 text-foreground font-medium">{item.customer_name || '-'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{item.source}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{item.sku || '-'}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{item.serial_number || '-'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{item.title || '-'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatMoney(item.total_amount ?? item.unit_amount, item.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState text="No item details imported yet." />
        )}
      </section>

      <section className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-foreground">Recent Shipments</h3>
        </div>
        {data?.shipments?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[980px]">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left px-3 py-2 font-medium">Customer</th>
                  <th className="text-left px-3 py-2 font-medium">Business</th>
                  <th className="text-left px-3 py-2 font-medium">Carrier</th>
                  <th className="text-left px-3 py-2 font-medium">Service</th>
                  <th className="text-left px-3 py-2 font-medium">Tracking</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                  <th className="text-left px-3 py-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.shipments.map((shipment) => (
                  <tr key={shipment.id} className="border-b border-border/50 hover:bg-secondary/40">
                    <td className="px-3 py-2 text-foreground font-medium">{shipment.customer_name || '-'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{shipment.business || '-'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{shipment.carrier || '-'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{shipment.service || '-'}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{shipment.tracking_number || '-'}</td>
                    <td className="px-3 py-2"><StatusPill ok label={shipment.tracking_status || 'Imported'} /></td>
                    <td className="px-3 py-2 text-muted-foreground">{formatMoney(shipment.amount, shipment.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState text="No shipments imported yet." />
        )}
      </section>
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
    <span className={`text-2xs px-2 py-1 rounded inline-flex items-center gap-1.5 ${
      ok ? 'bg-green-500/10 text-green-400' : 'bg-destructive/10 text-destructive'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-green-500' : 'bg-destructive'}`} />
      {label}
    </span>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="px-4 py-8 text-center text-xs text-muted-foreground">{text}</div>
}

function channelPill(status?: string) {
  if (!status) return <span className="text-2xs px-2 py-1 rounded bg-secondary text-muted-foreground">Missing</span>
  return <StatusPill ok label={status} />
}

function itemName(item: { brand?: string; model?: string; title?: string }) {
  return [item.brand, item.model].filter(Boolean).join(' ') || item.title || '-'
}

function formatMatchEvidence(value?: string) {
  const labels: Record<string, string> = {
    ecwid_product_reference: 'Ecwid ID',
    serial_number: 'Serial',
    sku: 'SKU',
    new_item: 'New'
  }
  return String(value || '')
    .split(',')
    .filter(Boolean)
    .map((entry) => labels[entry] || entry)
    .join(', ') || '-'
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

function ExternalIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3H3v10h10v-3" />
      <path d="M9 3h4v4" />
      <path d="M8 8l5-5" />
    </svg>
  )
}

function formatDate(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function formatMoney(amount?: number, currency?: string) {
  if (amount === undefined || amount === null) return '-'
  return `${Number(amount).toFixed(2)} ${currency || 'USD'}`
}
