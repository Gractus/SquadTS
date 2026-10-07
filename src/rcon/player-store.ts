import { isDeepStrictEqual } from 'node:util'

import type { eosID } from '../common/online-ids.js'
import {
  type ExternalIDs,
  type InGameIDs,
  type SquadID,
  TeamID,
} from '../common/types.js'
import SquadRconClient, {
  type RconEvents,
  type SquadListEntry,
  type Vehicle,
} from './squad-rcon-client.js'

/**
 * All known info about an in game player.
 */
export interface Player extends InGameIDs, ExternalIDs {
  connected: Date
  isLeader: boolean
  role: string
  vehicle?: Vehicle
}

/**
 * All IDs that could conceivably be used to find a player.
 */
interface PlayerIdentifiers extends InGameIDs, ExternalIDs {
  clanTag?: string
}

interface Squad {
  created: Date
  creator: ExternalIDs
  teamID: TeamID
  squadID: SquadID
  name: string
  locked: boolean
  leader: Player
  members: Player[]
  size: number
}

class TeamHelper {
  constructor(
    private store: PlayerStore,
    private teamID: TeamID
  ) {}
  get players() {
    return this.store['teams'][this.teamID].values()
  }
  get squads() {
    return this.store['squads'][this.teamID]
  }
  get unassigned() {
    return this.store['unassigned'][this.teamID].values()
  }
}

export class PlayerStore {
  private _players: Map<eosID, Player> = new Map()
  private teams: Record<TeamID, Map<eosID, Player>> = [new Map(), new Map()]
  private squads: Record<TeamID, Map<SquadID, Squad>> = [new Map(), new Map()]
  private unassigned: Record<TeamID, Map<eosID, Player>> = [
    new Map(),
    new Map(),
  ]

  // Access Helpers
  team1 = new TeamHelper(this, TeamID.team1)
  team2 = new TeamHelper(this, TeamID.team2)
  get players() {
    return this._players.values()
  }
  get playerCount() {
    return this._players.size
  }

  constructor(private client: SquadRconClient) {}

  async update() {
    const [newSquadList, { time: newTime, players: newPlayerList }] =
      await Promise.all([this.client.getSquads(), this.client.getListPlayers()])

    const latestSquadListMap: Record<TeamID, Map<SquadID, SquadListEntry>> = [
      new Map(),
      new Map(),
    ]
    newSquadList.squads.forEach(squad => {
      latestSquadListMap[squad.teamID].set(squad.squadID, squad)
    })

    const squadMembers: Record<
      TeamID,
      Map<
        SquadID,
        {
          leader: Player | undefined
          members: Player[]
        }
      >
    > = [new Map(), new Map()]

    // ------------------------------------------------------------
    // ---------------------- Update Players ----------------------
    // ------------------------------------------------------------

    const newTeamsCache: Record<TeamID, Map<string, Player>> = [
      new Map(),
      new Map(),
    ]
    const newUnassignedCache: Record<TeamID, Map<string, Player>> = [
      new Map(),
      new Map(),
    ]
    const newPlayerMap: Map<eosID, Player> = new Map()

    for (const newEntry of newPlayerList) {
      // Remove squadID if the squad the player is supposedly in doesn't appear in the squad list.
      // This should only happen if a squad is created in the moment between the squadlist request and the playerlist command returning.
      // The next update should pick up the squad, so just ignore it until then.
      // Could also happen if a squad was disbanded in between the squadlist and playerlist commands.
      if (
        newEntry.squadID &&
        !latestSquadListMap[newEntry.teamID].has(newEntry.squadID)
      ) {
        newEntry.squadID = undefined
        newEntry.isLeader = false
      }

      let player: Player

      const eosID = newEntry.eosID
      const existingPlayer = this._players.get(eosID)

      if (!existingPlayer) {
        player = {
          connected: newTime,
          ...newEntry,
        }
      } else {
        player = Object.assign({}, existingPlayer, newEntry)
      }
      newPlayerMap.set(eosID, player)
      newTeamsCache[player.teamID].set(player.eosID, player)

      if (player.squadID === undefined) {
        newUnassignedCache[player.teamID].set(player.eosID, player)
      } else {
        let squad = squadMembers[player.teamID].get(player.squadID)
        if (!squad) {
          squad = {
            leader: undefined,
            members: [],
          }
          squadMembers[player.teamID].set(player.squadID, squad)
        }
        if (player.isLeader) squad.leader = player
        squad.members.push(player)
      }
    }

    // -----------------------------------------------------------
    // ---------------------- Update Squads ----------------------
    // -----------------------------------------------------------

    const newSquads: Record<TeamID, Map<SquadID, Squad>> = [
      new Map(),
      new Map(),
    ]

    for (const teamID of Object.values(TeamID)) {
      const team = squadMembers[teamID]
      for (const [squadID, squadPlayers] of team) {
        if (!squadPlayers.leader) {
          throw new Error("Squad has no leader. This Shouldn't happen!")
        }

        const latestSquadListEntry = latestSquadListMap[teamID].get(squadID)!
        let squad = this.squads[teamID].get(squadID)

        if (
          latestSquadListEntry.creator.eosID === squad?.creator.eosID &&
          latestSquadListEntry.name === squad?.name
        ) {
          // Update to an existing squad.
          squad = Object.assign({}, squad, squadPlayers)
        } else {
          // New Squad
          squad = {
            created: newTime,
            leader: squadPlayers.leader,
            members: squadPlayers.members,
            ...latestSquadListEntry,
          }
        }
        newSquads[teamID].set(squadID, squad)
      }
    }

    // -----------------------------------------------------------------------
    // ---------------------- Commit New Squads/Players ----------------------
    // -----------------------------------------------------------------------

    // This must come before emitting any events, otherwise event handlers might try to access these and get outdated information.
    const oldSquads = this.squads
    const oldPlayerMap = this._players
    this.squads = newSquads
    this._players = newPlayerMap
    this.teams = newTeamsCache
    this.unassigned = newUnassignedCache

    // ----------------------------------------------------------------
    // ---------------------- Emit Player Events ----------------------
    // ----------------------------------------------------------------

    for (const [eosID, oldEntry] of oldPlayerMap.entries()) {
      if (!newPlayerMap.has(eosID)) {
        this.client.events.emit('PLAYER_DISCONNECTED', {
          player: oldEntry,
          connected: oldEntry.connected,
          disconnected: newTime,
        } satisfies RconEvents['PLAYER_DISCONNECTED'])
      }
    }

    for (const [eosID, currentPlayer] of this._players.entries()) {
      const previousPlayerEntry = oldPlayerMap.get(eosID)
      if (!previousPlayerEntry) {
        this.client.events.emit('PLAYER_CONNECTED', {
          time: newTime,
          player: currentPlayer,
        } satisfies RconEvents['PLAYER_CONNECTED'])
      }

      if (currentPlayer.name !== previousPlayerEntry?.name) {
        this.client.events.emit('PLAYER_CHANGED_NAME', {
          time: newTime,
          player: currentPlayer,
          newName: currentPlayer.name,
          oldName: previousPlayerEntry?.name,
        } satisfies RconEvents['PLAYER_CHANGED_NAME'])
      }

      if (currentPlayer.role !== previousPlayerEntry?.role) {
        this.client.events.emit('PLAYER_CHANGED_ROLE', {
          time: newTime,
          player: currentPlayer,
          newRole: currentPlayer.role,
          oldRole: previousPlayerEntry?.role,
        } satisfies RconEvents['PLAYER_CHANGED_ROLE'])
      }

      if (currentPlayer.teamID !== previousPlayerEntry?.teamID) {
        this.client.events.emit('PLAYER_CHANGED_TEAM', {
          time: newTime,
          player: currentPlayer,
          newTeamID: currentPlayer.teamID,
          oldTeamID: previousPlayerEntry?.teamID,
        } satisfies RconEvents['PLAYER_CHANGED_TEAM'])
        if (currentPlayer.squadID) {
          this.client.events.emit('PLAYER_CHANGED_SQUAD', {
            time: newTime,
            player: currentPlayer,
            newSquadID: currentPlayer.squadID,
          } satisfies RconEvents['PLAYER_CHANGED_SQUAD'])
        }
      } else if (currentPlayer.squadID !== previousPlayerEntry?.squadID) {
        this.client.events.emit('PLAYER_CHANGED_SQUAD', {
          time: newTime,
          player: currentPlayer,
          newSquadID: currentPlayer.squadID,
          oldSquadID: previousPlayerEntry?.squadID,
        } satisfies RconEvents['PLAYER_CHANGED_SQUAD'])
      }

      if (currentPlayer.isLeader !== previousPlayerEntry?.isLeader) {
        const event = currentPlayer.isLeader
          ? 'PLAYER_BECAME_SL'
          : 'PLAYER_NO_LONGER_SL'
        this.client.events.emit(event, {
          time: newTime,
          teamID: currentPlayer.teamID,
          squadID: currentPlayer.squadID!,
          player: currentPlayer,
        } satisfies RconEvents['PLAYER_BECAME_SL'] satisfies RconEvents['PLAYER_NO_LONGER_SL'])
      }

      if (
        !isDeepStrictEqual(currentPlayer.vehicle, previousPlayerEntry?.vehicle)
      ) {
        this.client.events.emit('PLAYER_CHANGED_VEHICLE', {
          time: newTime,
          player: currentPlayer,
          oldVehicle: previousPlayerEntry?.vehicle,
        } satisfies RconEvents['PLAYER_CHANGED_VEHICLE'])
      }
    }

    // ---------------------------------------------------------------
    // ---------------------- Emit Squad Events ----------------------
    // ---------------------------------------------------------------

    for (const teamID of Object.values(TeamID)) {
      for (const [squadID, squadEntry] of oldSquads[teamID]) {
        if (!newSquads[teamID].get(squadID)) {
          this.client.events.emit('SQUAD_DESTROYED', {
            time: newTime,
            teamID: teamID,
            squadID: squadID,
            name: squadEntry.name,
            creator: squadEntry.creator,
          } satisfies RconEvents['SQUAD_DESTROYED'])
        }
      }
    }

    for (const teamID of Object.values(TeamID)) {
      for (const [squadID, newSquad] of newSquads[teamID].entries()) {
        const oldSquad = oldSquads[teamID].get(squadID)
        if (
          newSquad.creator.eosID === oldSquad?.creator.eosID &&
          newSquad.name === oldSquad?.name
        ) {
          // Latest entry is an update to an existing squad
          if (oldSquad.leader.eosID !== newSquad.leader.eosID) {
            this.client.events.emit('SQUAD_LEADER_CHANGED', {
              time: newTime,
              teamID: teamID,
              squadID: squadID,
              oldLeader: oldSquad.leader,
              newLeader: newSquad.leader,
            } satisfies RconEvents['SQUAD_LEADER_CHANGED'])
          }
          if (newSquad.locked !== oldSquad.locked) {
            const event = newSquad.locked ? 'SQUAD_LOCKED' : 'SQUAD_UNLOCKED'
            this.client.events.emit(event, {
              time: newTime,
              teamID: teamID,
              squadID: squadID,
            } satisfies RconEvents['SQUAD_LOCKED'] satisfies RconEvents['SQUAD_UNLOCKED'])
          }
        } else {
          this.client.events.emit('SQUAD_CREATED', {
            time: newSquad.created,
            teamID: newSquad.teamID,
            squadID: newSquad.squadID,
            name: newSquad.name,
            locked: newSquad.locked,
            creator: newSquad.creator,
          } satisfies RconEvents['SQUAD_CREATED'])
        }
      }
    }
  }

  getPlayer<T extends Partial<PlayerIdentifiers>>(
    possibleIDs: T
  ): Player | undefined {
    let storedPlayer

    if (possibleIDs.playerID)
      storedPlayer = this.getPlayerByPlayerID(possibleIDs.playerID)
    if (storedPlayer !== undefined) return storedPlayer

    if (possibleIDs.eosID)
      storedPlayer = this.getPlayerByEOSID(possibleIDs.eosID)
    if (storedPlayer !== undefined) return storedPlayer

    if (possibleIDs.steamID)
      storedPlayer = this.getPlayerBySteamID(possibleIDs.steamID)
    if (storedPlayer !== undefined) return storedPlayer

    let matches
    if (possibleIDs.name) matches = [...this.getPlayersByName(possibleIDs.name)]
    if (matches) {
      if (matches.length === 1) {
        return matches[0]
      } else if (possibleIDs.teamID) {
        matches = matches.filter(player => player.teamID === possibleIDs.teamID)
        if (matches.length === 1) {
          return matches[0]
        }
      }
      throw new Error('Multiple players have the same name.')
    }
    return storedPlayer
  }

  getPlayerByEOSID(eosID: string): Player | undefined {
    return this._players.get(eosID)
  }

  getPlayerByPlayerID(playerID: number): Player | undefined {
    return this._players.values().find(player => player.playerID === playerID)
  }

  getPlayerBySteamID(steamID: string): Player | undefined {
    return this._players.values().find(player => player.steamID === steamID)
  }

  getPlayersByName(name: string): IteratorObject<Player, undefined, unknown> {
    return this._players.values().filter(player => player.name === name)
  }
}
