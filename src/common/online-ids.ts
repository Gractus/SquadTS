export type eosID = string
export type steamID = string

export interface OnlineIDs {
  eosID: eosID
  steamID?: steamID
}

const ID_MATCHER = /\s*(?<name>[^\s:]+)\s*:\s*(?<id>[^\s]+)/g

export function parseIDs(input: string) {
  const result: { [key: string]: string } = {}
  for (const match of input.matchAll(ID_MATCHER)) {
    const name = match.groups!.name.toLowerCase()
    switch (name) {
      case 'steam':
        result.steamID = match.groups!.id
        break
      case 'eos':
        result.eosID = match.groups!.id
        break
    }
  }
  if (!result?.eosID) {
    // In order to make an eosID optional we need another globally (in the scope of SquadJS) unique and reliable way to ID players.
    // One option would be to generate an internal "SquadJS ID" that becomes the "core" ID much like the eosID is used now.
    // That would require a translation layer that's not worth implementing if we're confident that every player will have an eosID.
    throw new Error(
      'Missing eosID. Please report this error to SquadJS developers since we need to know if this can actually happen.'
    )
  }
  return result as unknown as OnlineIDs
}
