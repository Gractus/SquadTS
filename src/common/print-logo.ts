import { styleText } from 'node:util'

import { COPYRIGHT_MESSAGE } from './constants.js'
import { getLatestVersion, isOlder, SQUADJS_VERSION } from './version.js'

export async function printLogo() {
  console.log(
    `\x1b[0;33m      ::::::::   ::::::::   :::    :::     :::     :::::::::     \x1b[0;34m::::::::::: ::::::::\x1b[97m
    \x1b[0;33m:+:    :+: :+:    :+:  :+:    :+:   :+: :+:   :+:    :+:        \x1b[0;34m:+:    :+:    :+:\x1b[97m
   \x1b[0;33m+:+        +:+    +:+  +:+    +:+  +:+   +:+  +:+    +:+        \x1b[0;34m+:+    +:+\x1b[97m
  \x1b[0;33m+#++:++#++ +#+    +:+  +#+    +:+ +#++:++#++: +#+    +:+        \x1b[0;34m+#+    +#++:++#++\x1b[97m
        \x1b[0;33m+#+ +#+    +#+  +#+    +#+ +#+     +#+ +#+    +#+        \x1b[0;34m+#+           +#+\x1b[97m
\x1b[0;33m#+#    #+# #+#    #+#  #+#    #+# #+#     #+# #+#    #+# \x1b[97m#+#    \x1b[0;34m#+#    #+#    #+#\x1b[97m
\x1b[0;33m########   ########### ########  ###     ### #########  \x1b[97m###    \x1b[0;34m###     ########\x1b[97m       `
  )

  console.log(`
${COPYRIGHT_MESSAGE}
GitHub: https://github.com/Team-Silver-Sphere/SquadJS
`)

  console.log()

  let versionString
  const latestVersion = await getLatestVersion()
  let isOutdated = false
  if (latestVersion) {
    isOutdated = isOlder(SQUADJS_VERSION, latestVersion)
    versionString = `Latest Version: ${styleText('green', latestVersion)}`
  } else {
    versionString =
      styleText('red', 'Checking for updates failed!\n') +
      `Latest Version: ${styleText('red', 'UNKNOWN')}`
  }

  versionString += ', Installed Version: '

  if (isOutdated) {
    versionString += styleText('red', SQUADJS_VERSION)
    console.log(versionString)
    console.log(
      styleText(
        'red',
        'Your SquadJS version is outdated, please consider updating.'
      )
    )
  } else {
    versionString += styleText('green', SQUADJS_VERSION)
    console.log(versionString)
    console.log(styleText('green', 'Your SquadJS version is up to date.'))
  }

  console.log()

  console.log(
    styleText(
      'yellow',
      'Looking for ways to help protect your server from harmful players?\nCheckout the Squad Community Ban List: https://communitybanlist.com/'
    )
  )
}
