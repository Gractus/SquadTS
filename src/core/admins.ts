import { Client as FTPClient } from 'basic-ftp'
import fs from 'fs'
import { Writable } from 'stream'

import { type steamID } from '../common/online-ids.js'

export interface AdminList {
  type: 'local' | 'remote' | 'ftp'
  source: string
}

export type AdminsRegister = Map<AdminID, Record<Perm, boolean>>

type AdminID = steamID
type Perm = string

async function fetchRawList(adminList: AdminList): Promise<string> {
  let data: string
  switch (adminList.type) {
    case 'local': {
      data = fs.readFileSync(adminList.source, 'utf8')
      break
    }
    case 'remote': {
      const resp = await fetch(adminList.source)
      if (!resp.ok) {
        throw new Error(
          `Failed to retrieve admin list from ${resp.url}: HTTP Status ${resp.status} - ${resp.statusText}`
        )
      }
      data = await resp.json()
      break
    }
    case 'ftp': {
      // example url: ftp://<user>:<password>@<host>:<port>/<url-path>
      const match = adminList.source.match(
        /^ftp:\/\/(?<user>.*):(?<password>.*)@(?<host>.*):(?<port>\d*)\/(?<path>.*)/
      )
      if (!match?.groups) {
        throw new Error(
          `Invalid FTP URI format of ${adminList.source}. The source must be a FTP URI starting with the protocol. Ex: ftp://username:password@host:21/some/file.txt`
        )
      }
      const ftpClient = new FTPClient()
      await ftpClient.access({
        host: match.groups.host,
        port: +match.groups.port,
        user: match.groups.user,
        password: match.groups.password,
      })
      const chunks: Buffer[] = []
      const collector = new Writable({
        write(chunk: Buffer, _encoding, callback) {
          chunks.push(chunk)
          callback()
        },
      })
      await ftpClient.downloadTo(collector, match.groups.path)
      data = Buffer.concat(chunks).toString('utf8')
      ftpClient.close()
      break
    }
    default:
      throw new Error(`Unsupported AdminList type:${adminList.type}`)
  }
  return data
}

async function readAdminList(adminList: AdminList) {
  const admins: AdminsRegister = new Map()

  let data
  try {
    data = await fetchRawList(adminList)
  } catch (err) {
    throw new Error(`Failed to retrieve admin list: ${adminList.source}`, {
      cause: err,
    })
  }

  const groupRgx =
    /(?<=^Group=)(?<groupID>.*?):(?<groupPerms>.*?)(?=(?:\r\n|\r|\n|\s+\/\/))/gm
  const adminRgx =
    /(?<=^Admin=)(?<adminID>\d{17}|[a-f0-9]{32}):(?<groupID>\S+)/gm

  try {
    const groupPerms: Record<string, string[]> = {}
    for (const groupRgxMatch of data.matchAll(groupRgx)) {
      groupPerms[groupRgxMatch.groups!.groupID] = groupRgxMatch
        .groups!.groupPerms.toLowerCase()
        .split(',')
    }

    for (const adminMatch of data.matchAll(adminRgx)) {
      const adminID = adminMatch.groups!.adminID
      const perms: Record<Perm, boolean> = Object.fromEntries(
        groupPerms[adminMatch.groups!.groupID].map(perm => [perm, true])
      )
      const admin = admins.get(adminID)

      if (admin) {
        Object.assign(admin, perms)
      } else {
        admins.set(adminID, perms)
      }
    }
  } catch (error) {
    throw new Error(
      `Error parsing admin list: ${adminList.source} - ${error}`,
      { cause: error }
    )
  }
  return admins
}

export async function readAdminLists(adminLists: AdminList[]) {
  const admins: AdminsRegister = new Map()

  for (const list of adminLists) {
    for (const [adminID, perms] of (await readAdminList(list)).entries()) {
      const admin = admins.get(adminID)
      if (admin) {
        Object.assign(admin, perms)
      } else {
        admins.set(adminID, perms)
      }
    }
  }
  return admins
}

export function getAdminsWithPerm(
  admins: AdminsRegister,
  perm: string
): AdminID[] {
  return Array.from(
    admins.keys().filter(adminID => admins.get(adminID)?.[perm])
  )
}
