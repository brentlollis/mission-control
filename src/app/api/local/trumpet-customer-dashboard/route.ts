import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { requireRole } from '@/lib/auth'

const BRENT_AI_PROJECTS_ROOT = process.env.BRENT_AI_PROJECTS_ROOT
  || 'C:\\Users\\brent-ai\\Projects'
const DASHBOARD_DIR = process.env.TRUMPET_CUSTOMER_DASHBOARD_DIR
  || join(BRENT_AI_PROJECTS_ROOT, 'active', 'trumpet-customer-dashboard')
const DASHBOARD_DB = process.env.TRUMPET_CUSTOMER_DASHBOARD_DB
  || join(DASHBOARD_DIR, 'data', 'trumpet-customers.sqlite')
const DASHBOARD_URL = process.env.TRUMPET_CUSTOMER_DASHBOARD_URL
  || 'http://127.0.0.1:8791'

function openReadOnlyDb() {
  if (!existsSync(DASHBOARD_DB)) return null
  return new Database(DASHBOARD_DB, { readonly: true, fileMustExist: true })
}

function dashboardSummary() {
  const db = openReadOnlyDb()
  if (!db) {
    return {
      ok: false,
      generatedAt: new Date().toISOString(),
      dashboardUrl: DASHBOARD_URL,
      dbPath: DASHBOARD_DB,
      error: 'Trumpet customer dashboard database has not been initialized yet.',
      customerCount: 0,
      shipmentCount: 0,
      transactionCount: 0,
      transactionItemCount: 0,
      instrumentCount: 0,
      inventoryCount: 0,
      activeListingCount: 0,
      soldItemCount: 0,
      sourceRecordCount: 0,
      customers: [],
      inventoryItems: [],
      soldItems: [],
      transactions: [],
      transactionItems: [],
      shipments: [],
      sources: [],
      syncRuns: [],
    }
  }

  try {
    const counts = {
      customerCount: db.prepare('SELECT COUNT(*) AS count FROM customers').get() as { count: number },
      shipmentCount: db.prepare('SELECT COUNT(*) AS count FROM shipments').get() as { count: number },
      transactionCount: db.prepare('SELECT COUNT(*) AS count FROM transactions').get() as { count: number },
      transactionItemCount: db.prepare('SELECT COUNT(*) AS count FROM transaction_items').get() as { count: number },
      instrumentCount: db.prepare('SELECT COUNT(*) AS count FROM instrument_records').get() as { count: number },
      inventoryCount: db.prepare("SELECT COUNT(*) AS count FROM inventory_items WHERE owned = 1 OR status IN ('owned', 'listed')").get() as { count: number },
      activeListingCount: db.prepare("SELECT COUNT(*) AS count FROM inventory_listings WHERE lower(COALESCE(status, '')) = 'active'").get() as { count: number },
      soldItemCount: db.prepare('SELECT COUNT(*) AS count FROM sold_items').get() as { count: number },
      sourceRecordCount: db.prepare('SELECT COUNT(*) AS count FROM source_records').get() as { count: number },
    }
    const customers = db.prepare(`
      SELECT c.id, c.display_name, c.primary_email, c.primary_phone,
        COUNT(DISTINCT t.id) AS transaction_count,
        COUNT(DISTINCT s.id) AS shipment_count,
        MAX(COALESCE(t.occurred_at, s.shipment_date, s.created_at, c.updated_at)) AS last_activity_at
      FROM customers c
      LEFT JOIN transactions t ON t.customer_id = c.id
      LEFT JOIN shipments s ON s.customer_id = c.id
      GROUP BY c.id
      ORDER BY COALESCE(last_activity_at, c.created_at) DESC
      LIMIT 100
    `).all()
    const shipments = db.prepare(`
      SELECT s.id, s.business, s.carrier, s.service, s.tracking_number, s.tracking_status,
        s.label_transaction_id, s.shippo_rate_id, s.shippo_shipment_id, s.shipment_date,
        s.amount, s.currency, c.display_name AS customer_name
      FROM shipments s
      LEFT JOIN customers c ON c.id = s.customer_id
      ORDER BY COALESCE(s.shipment_date, s.created_at) DESC
      LIMIT 100
    `).all()
    const transactions = db.prepare(`
      SELECT t.id, t.business, t.source, t.source_id, t.transaction_type, t.occurred_at,
        t.status, t.title, t.amount, t.currency, c.display_name AS customer_name
      FROM transactions t
      LEFT JOIN customers c ON c.id = t.customer_id
      ORDER BY COALESCE(t.occurred_at, t.created_at) DESC
      LIMIT 100
    `).all()
    const inventoryItems = db.prepare(`
      SELECT ii.id, ii.business, ii.status, ii.brand, ii.model, ii.serial_number, ii.sku, ii.title,
        ii.year, ii.bore_size, ii.owned, ii.asking_price, ii.currency, ii.confidence,
        MAX(CASE WHEN il.source = 'ecwid' THEN il.status END) AS ecwid_status,
        MAX(CASE WHEN il.source = 'reverb' THEN il.status END) AS reverb_status,
        MAX(CASE WHEN il.source = 'ebay' THEN il.status END) AS ebay_status,
        GROUP_CONCAT(DISTINCT ime.match_type) AS match_evidence,
        COUNT(DISTINCT il.id) AS listing_count
      FROM inventory_items ii
      LEFT JOIN inventory_listings il ON il.inventory_item_id = ii.id
      LEFT JOIN item_match_events ime ON ime.inventory_item_id = ii.id
      WHERE ii.owned = 1 OR ii.status IN ('owned', 'listed')
      GROUP BY ii.id
      ORDER BY ii.owned DESC, COALESCE(ii.updated_at, ii.created_at) DESC
      LIMIT 200
    `).all()
    const soldItems = db.prepare(`
      SELECT si.id, si.source, si.source_sale_id, si.source_item_id, si.sold_at, si.title, si.sku,
        si.serial_number, si.amount, si.currency, si.status, c.display_name AS customer_name,
        ii.brand, ii.model, s.tracking_number
      FROM sold_items si
      LEFT JOIN customers c ON c.id = si.customer_id
      LEFT JOIN inventory_items ii ON ii.id = si.inventory_item_id
      LEFT JOIN shipments s ON s.transaction_id = si.transaction_id
      ORDER BY COALESCE(si.sold_at, si.created_at) DESC
      LIMIT 200
    `).all()
    const transactionItems = db.prepare(`
      SELECT ti.id, ti.source, ti.source_item_id, ti.platform_listing_id, ti.sku, ti.serial_number,
        ti.title, ti.brand, ti.model, ti.quantity, ti.unit_amount, ti.total_amount, ti.currency,
        t.source_id AS transaction_source_id, c.display_name AS customer_name
      FROM transaction_items ti
      LEFT JOIN transactions t ON t.id = ti.transaction_id
      LEFT JOIN customers c ON c.id = t.customer_id
      ORDER BY ti.created_at DESC
      LIMIT 100
    `).all()
    const sources = db.prepare(`
      SELECT source, source_kind, COUNT(*) AS count, MAX(imported_at) AS last_imported_at
      FROM source_records
      GROUP BY source, source_kind
      ORDER BY MAX(imported_at) DESC
    `).all()
    const syncRuns = db.prepare(`
      SELECT id, source, source_kind, status, window_start, window_end,
        fetched_count, imported_count, error_count, started_at, finished_at
      FROM sync_runs
      ORDER BY started_at DESC, id DESC
      LIMIT 20
    `).all()

    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      dashboardUrl: DASHBOARD_URL,
      dbPath: DASHBOARD_DB,
      customerCount: counts.customerCount.count,
      shipmentCount: counts.shipmentCount.count,
      transactionCount: counts.transactionCount.count,
      transactionItemCount: counts.transactionItemCount.count,
      instrumentCount: counts.instrumentCount.count,
      inventoryCount: counts.inventoryCount.count,
      activeListingCount: counts.activeListingCount.count,
      soldItemCount: counts.soldItemCount.count,
      sourceRecordCount: counts.sourceRecordCount.count,
      customers,
      inventoryItems,
      soldItems,
      transactions,
      transactionItems,
      shipments,
      sources,
      syncRuns,
    }
  } finally {
    db.close()
  }
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    return NextResponse.json(dashboardSummary())
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: String(error?.message || error).slice(0, 800),
      generatedAt: new Date().toISOString(),
      dashboardUrl: DASHBOARD_URL,
      dbPath: DASHBOARD_DB,
    }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
