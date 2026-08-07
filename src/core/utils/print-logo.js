import { COPYRIGHT_MESSAGE, SQUADJS_VERSION } from './constants.js';

import * as version from './check-version.js';

export default async function () {
  let versionString;
  try {
    const latestVersion = await version.getLatestVersion();
    const isOutdated = await version.isOlder(SQUADJS_VERSION, latestVersion);
    versionString = `Latest Version: ${isOutdated ? '\x1b[32m' : '\x1b[31m'}${latestVersion}\x1b[0m, Installed Version: \x1b[32m${SQUADJS_VERSION}\x1b[0m
${
  isOutdated
    ? '\x1b[32mYour SquadJS version is up to date.'
    : '\x1b[31mYour SquadJS version is outdated, please consider updating.'
}\x1b[0m`;
    // eslint-disable-next-line no-unused-vars
  } catch (e) {
    versionString = `Latest Version: \x1b[32mUNKNOWN\x1b[0m, Installed Version: \x1b[32m${SQUADJS_VERSION}\x1b[0m
    \x1b[31mChecking for updates Failed.'\x1b[0m`;
  }

  console.log(
    `
   _____  ____  _    _         _____   \x1b[33m_\x1b[0m
  / ____|/ __ \\| |  | |  /\\   |  __ \\ \x1b[33m(_)\x1b[0m
 | (___ | |  | | |  | | /  \\  | |  | | \x1b[33m_ ___\x1b[0m
  \\___ \\| |  | | |  | |/ /\\ \\ | |  | |\x1b[33m| / __|\x1b[0m
  ____) | |__| | |__| / ____ \\| |__| |\x1b[33m| \\__ \\\x1b[0m
 |_____/ \\___\\_\\\\____/_/    \\_\\_____\x1b[33m(_) |___/\x1b[0m
                                     \x1b[33m_/ |\x1b[0m
                                    \x1b[33m|__/\x1b[0m
${COPYRIGHT_MESSAGE}
GitHub: https://github.com/Team-Silver-Sphere/SquadJS

${versionString}

\x1b[33mLooking for ways to help protect your server from harmful players?
Checkout the Squad Community Ban List: https://communitybanlist.com/\x1b[0m
`
  );
}
