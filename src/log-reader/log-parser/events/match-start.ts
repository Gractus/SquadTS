import { getLayerByClassname, type Layer } from '../../../game-info/layers.js'
import SquadLogParser, { type Rule } from '../log-parser.js'

declare module '../log-parser.js' {
  interface LogEvents {
    MATCH_START: {
      time: Date
      layer?: Layer
    }
  }
}

// LogWorld: Bringing World /Game/Maps/Fallujah_City/Gameplay_Layers/Fallujah_RAAS_v1.Fallujah_RAAS_v1 up for play (max tick rate 64) at 2026.09.19-12.22.22
// OR
// LogWorld: Bringing World /Game/Maps/TransitionMap.TransitionMap up for play (max tick rate 64) at 2026.09.19-13.13.49

export default {
  pattern:
    /^LogWorld: Bringing World \/(?<dlc>[A-z0-9]+)\/(?:Maps\/)?(?<mapClassname>[A-z0-9-]+)\/(?:.+\/)?(?<layerClassname>[A-z0-9-]+)(?:\.[A-z0-9-]+)/,
  action: (
    time: Date,
    chainID: number,
    groups: Record<string, string>,
    logParser: SquadLogParser
  ) => {
    // Skip "TransitionMap" events
    if (groups.layerClassname === 'TransitionMap') return

    logParser.events.emit('MATCH_START', {
      time: time,
      layer: getLayerByClassname(groups.layerClassname),
    })
    logParser.eventStore.deployables.clear()
  },
} as Rule
