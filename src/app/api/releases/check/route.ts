import { NextResponse } from 'next/server'
import { existsSync } from 'node:fs'
import { APP_VERSION } from '@/lib/version'

const GITHUB_RELEASES_URL =
  'https://api.github.com/repos/builderz-labs/mission-control/releases/latest'
const responseHeaders = { 'Cache-Control': 'no-store' }

/** Simple semver compare: returns 1 if a > b, -1 if a < b, 0 if equal. */
function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map(Number)
  const pb = b.replace(/^v/, '').split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0
    const nb = pb[i] ?? 0
    if (na > nb) return 1
    if (na < nb) return -1
  }
  return 0
}

function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/, '').split('-')[0] || APP_VERSION
}

function currentReleaseVersion(): string {
  return normalizeVersion(process.env.MC_CURRENT_RELEASE_TAG || APP_VERSION)
}

export async function GET() {
  try {
    const currentVersion = currentReleaseVersion()
    const res = await fetch(GITHUB_RELEASES_URL, {
      headers: { Accept: 'application/vnd.github+json' },
      next: { revalidate: 3600 }, // ISR cache for 1 hour
    })

    if (!res.ok) {
      return NextResponse.json(
        { updateAvailable: false, currentVersion, packageVersion: APP_VERSION },
        { headers: responseHeaders }
      )
    }

    const release = await res.json()
    const latestVersion = normalizeVersion(release.tag_name ?? '')
    const updateAvailable = compareSemver(latestVersion, currentVersion) > 0

    const deploymentMode = existsSync('/.dockerenv') ? 'docker' : 'bare-metal'

    return NextResponse.json(
      {
        updateAvailable,
        currentVersion,
        packageVersion: APP_VERSION,
        latestVersion,
        releaseUrl: release.html_url ?? '',
        releaseNotes: release.body ?? '',
        deploymentMode,
      },
      { headers: responseHeaders }
    )
  } catch {
    // Network error — fail gracefully
    const currentVersion = currentReleaseVersion()
    return NextResponse.json(
      { updateAvailable: false, currentVersion, packageVersion: APP_VERSION },
      { headers: responseHeaders }
    )
  }
}
