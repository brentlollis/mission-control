import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { requireRole } from '@/lib/auth'

const DASHBOARD_DIR = process.env.TRUMPET_CUSTOMER_DASHBOARD_DIR
  || join(homedir(), 'Projects', 'active', 'trumpet-customer-dashboard')
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
      sourceRecordCount: 0,
      customers: [],
      shipments: [],
      sources: [],
    }
  }

  try {
    const counts = {
      customerCount: db.prepare('SELECT COUNT(*) AS count FROM customers').get() as { count: number },
      shipmentCount: db.prepare('SELECT COUNT(*) AS count FROM shipments').get() as { count: number },
      transactionCount: db.prepare('SELECT COUNT(*) AS count FROM transactions').get() as { count: number },
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
    const sources = db.prepare(`
      SELECT source, source_kind, COUNT(*) AS count, MAX(imported_at) AS last_imported_at
      FROM source_records
      GROUP BY source, source_kind
      ORDER BY MAX(imported_at) DESC
    `).all()

    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      dashboardUrl: DASHBOARD_URL,
      dbPath: DASHBOARD_DB,
      customerCount: counts.customerCount.count,
      shipmentCount: counts.shipmentCount.count,
      transactionCount: counts.transactionCount.count,
      sourceRecordCount: counts.sourceRecordCount.count,
      customers,
      shipments,
      sources,
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
