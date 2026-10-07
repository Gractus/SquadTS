import fs from 'fs'
import path from 'path'

export const SQUADJS_VERSION: string = JSON.parse(
  fs.readFileSync(
    path.resolve(import.meta.dirname, '../../package.json'),
    'utf8'
  )
).version

/**
 * @param {string} a - Format `major.minor.patch`.
 * @param {string} b - Format `major.minor.patch`.
 * @returns {boolean} True if a is older than b.
 */
export function isOlder(a: string, b: string): boolean {
  const versionA = a.match(
    /(?<major>[0-9]+)\.(?<minor>[0-9]+)\.(?<patch>[0-9]+)/
  )?.groups
  const versionB = b.match(
    /(?<major>[0-9]+)\.(?<minor>[0-9]+)\.(?<patch>[0-9]+)/
  )?.groups

  if (!versionA || !versionB) throw new Error('Invalid version string format!')

  let isOlder = true
  // Every part of versionA must be greater than or equal to versionB to be up to date.
  if (versionA.major >= versionB.major) {
    if (versionA.minor >= versionB.minor) {
      if (versionA.patch >= versionB.patch) {
        isOlder = false
      }
    }
  }
  return isOlder
}

export async function getLatestVersion(): Promise<string | undefined> {
  const response = await fetch(
    `https://raw.githubusercontent.com/Team-Silver-Sphere/SquadJS/master/package.json`
  )
  if (!response.ok) {
    console.log(
      `Failed to retrieve SquadJS version: HTTP Status ${response.status} - ${response.statusText}`
    )
    return
  }
  const data = await response.json()
  return data.version
}

export function getCurrent() {
  return SQUADJS_VERSION
}

export async function isUpToDate() {
  const latestVersion = await getLatestVersion()
  if (!latestVersion) {
    return true
  }
  return !isOlder(SQUADJS_VERSION, latestVersion)
}
