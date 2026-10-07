<div align="center">

<img src="assets/squadjs-logo-white.png#gh-dark-mode-only" alt="Logo" width="500"/>
<img src="assets/squadjs-logo.png#gh-light-mode-only" alt="Logo" width="500"/>

#### SquadJS

[![GitHub release](https://img.shields.io/github/release/Team-Silver-Sphere/SquadJS.svg?style=flat-square)](https://github.com/Team-Silver-Sphere/SquadJS/releases)
[![GitHub contributors](https://img.shields.io/github/contributors/Team-Silver-Sphere/SquadJS.svg?style=flat-square)](https://github.com/Team-Silver-Sphere/SquadJS/graphs/contributors)
[![GitHub release](https://img.shields.io/github/license/Team-Silver-Sphere/SquadJS.svg?style=flat-square)](https://github.com/Team-Silver-Sphere/SquadJS/blob/master/LICENSE)

<br>

[![GitHub issues](https://img.shields.io/github/issues/Team-Silver-Sphere/SquadJS.svg?style=flat-square)](https://github.com/Team-Silver-Sphere/SquadJS/issues)
[![GitHub pull requests](https://img.shields.io/github/issues-pr-raw/Team-Silver-Sphere/SquadJS.svg?style=flat-square)](https://github.com/Team-Silver-Sphere/SquadJS/pulls)
[![GitHub issues](https://img.shields.io/github/stars/Team-Silver-Sphere/SquadJS.svg?style=flat-square)](https://github.com/Team-Silver-Sphere/SquadJS/stargazers)
[![Discord](https://img.shields.io/discord/266210223406972928.svg?style=flat-square&logo=discord)](https://discord.gg/9F2Ng5C)

<br><br>
</div>

## **About**
SquadJS is a scripting framework, designed for Squad servers, that aims to handle all communication and data collection to and from the servers. Using SquadJS as the base to any of your scripting projects allows you to easily write complex plugins without having to worry about the hassle of RCON or log parsing. However, for your convenience SquadJS comes shipped with multiple plugins already built for you allowing you to experience the power of SquadJS right away.

<br>

## **Using SquadJS**
SquadJS relies on being able to access the Squad server log directory in order to parse logs live to collect information. Thus, SquadJS must be hosted on the same server box as your Squad server or be connected to your Squad server via FTP.

#### Prerequisites
* Git
* [Node.js](https://nodejs.org/en/) (24.x) - [Download](https://nodejs.org/en/)
* [pnpm](https://pnpm.io//) (Version 11.0+) - [Download](https://pnpm.io/installation)
* Some plugins may have additional requirements.

#### Installation
1. [Download SquadJS](https://github.com/Team-Silver-Sphere/SquadJS/releases/latest) and unzip the download.
2. Open the unzipped folder in your terminal.
3. Install the dependencies by running `pnpm install` in your terminal.
4. Configure the `config.json` file. See below for more details.
5. Start SquadJS by running `node dist/index.js` in your terminal.

**Note** - If you are interested in testing versions of SquadJS not yet released please download/clone the `master` branch. Please also see [here](#versions-and-releases) for more information on our versions and release procedures.

<br>

## **Configuring SquadJS**
SquadJS can be configured via a JSON configuration file which, by default, is located in the SquadJS and is named [config.json](./config.json).

The config file needs to be valid JSON syntax. If an error is thrown saying the config cannot be parsed then try putting the config into a JSON syntax checker (there's plenty to choose from that can be found via Google).

<details>
  <summary>Server</summary>

## Server Configuration

The following section of the configuration contains information about your Squad server.

  ```json
"server": {
    "id": 1,
    "host": "127.0.0.1",
    "queryPort": 27165,
    "rcon": {
      "port": 21114,
      "password": "hunter2"
    },
    "logReader": {
      "logFile": "C:/path/to/your/Squad Dedicated Server/SquadGame/Saved/Logs/SquadGame.log",
      "mode": "local",
      "ftp": {
        "host": "xxx.xxx.xxx.xxx",
        "port": 21,
        "user": "FTP Username",
        "password": "FTP Password"
      },
      "sftp": {
        "host": "xxx.xxx.xxx.xxx",
        "port": 22,
        "username": "SFTP Username",
        "password": "SFTP Password"
      }
    },
    "adminLists": [
      {
        "type": "local",
        "source": "C:/path/to/your/Squad Dedicated Server/SquadGame/ServerConfig/Admins.cfg"
      },
      {
        "type": "remote",
        "source": "http://yourWebsite.com/Server1/Admins.cfg"
      },
      {
        "type": "ftp",
        "source": "ftp://<user>:<password>@<host>:<port>/<url-path>"
      }
    ],
    "plugins": [],
    "layerHistoryMaxLength": 20
  }
  ```
* `id` - An integer ID to uniquely identify the server.
* `host` - The IP of the server.
* `queryPort` - The query port of the server.
* `rconPort` - The RCON port of the server.
* `rconPassword` - The RCON password of the server.
* `logReaderMode` - `tail` will read from a local log file, `ftp` will read from a remote log file using the FTP protocol, `sftp` will read from a remote log file using the SFTP protocol.
* `logDir` - The folder where your Squad logs are saved. Most likely will be `C:/servers/squad_server/SquadGame/Saved/Logs`.
* `ftp` - FTP configuration for reading logs remotely. Only required for `ftp` `logReaderMode`.
* `sftp` - SFTP configuration for reading logs remotely. Only required for `sftp` `logReaderMode`.
* `adminLists` - Sources for identifying an admins on the server, either remote or local.

  ---
</details>

<details>
  <summary>Plugins</summary>

## Plugin Configuration

The `plugins` section in your config file lists all plugins built into SquadJS
  ```json
    "plugins": [
      {
        "plugin": "auto-tk-warn",
        "disabled": false,
        "message": "Please apologise for ALL TKs in ALL chat!"
      }
    ]
  ```

The `disabled` field can be toggled between `true`/ `false` to enabled/disable the plugin.

Plugin options are also specified. A full list of plugin options can be seen below.

  ---
</details>

<details>
  <summary>Verboseness</summary>

## Console Output Configuration

The `logger` section configures how verbose a module of SquadJS will be as well as the displayed color.
  ```json
    "logger": {
      "verboseness": {
        "SquadServer": 1,
        "LogParser": 1,
        "RCON": 1
      },
      "colors": {
        "SquadServer": "yellowBright",
        "SquadServerFactory": "yellowBright",
        "LogParser": "blueBright",
        "RCON": "redBright"
      }
    }
  ```
The larger the number set in the `verboseness` section for a specified module the more it will print to the console.

  ---
</details>

<br>

## **Plugins**
The following is a list of plugins built into SquadJS, you can click their title for more information:

Interested in creating your own plugin? [See more here](./squad-server/plugins/readme.md)

<details>
<summary>AutoKickUnassigned</summary>
<h2>AutoKickUnassigned</h2>
<p>The <code>AutoKickUnassigned</code> plugin will automatically kick players that are not in a squad after a specified amount of time.</p>
<h3>Options</h3>
<table>
<tr>
  <td>Option</td>
  <td>Description</td>
  <td>Default</td>
  <td>Example</td>
</tr>
<tr>
  <td>playerThreshold</td>
  <td>Player count required for AutoKick to start kicking players, set to -1 to disable</td>
  <td><code>93</code></td>
  <td></td>
</tr>
<tr>
  <td>timeBeforeKick</td>
  <td>How long in <b>Seconds</b> to wait before a unassigned player is kicked</td>
  <td><code>360</code></td>
  <td></td>
</tr>
<tr>
  <td>warnInterval</td>
  <td>How often in <b>Seconds</b> should we warn the player about being unassigned?</td>
  <td><code>30</code></td>
  <td></td>
</tr>
<tr>
  <td>warningMessage</td>
  <td>Warning message sent to unassigned players.</td>
  <td><code>Join a squad, you are unassigned and will be kicked</code></td>
  <td></td>
</tr>
<tr>
  <td>kickMessage</td>
  <td>Message set to players when they are kicked</td>
  <td><code>Autokick - All players must join a squad.</code></td>
  <td></td>
</tr>
<tr>
  <td>roundStartDelay</td>
  <td>Time delay in <b>Seconds</b> from start of the round before AutoKick starts kicking again</td>
  <td><code>900</code></td>
  <td></td>
</tr>
<tr>
  <td>ignoreAdmins</td>
  <td><ul><li><code>true</code>: Admins will <b>NOT</b> be kicked</li><li><code>false</code>: Admins <b>WILL</b> be kicked</li></ul></td>
  <td><code>false</code></td>
  <td></td>
</tr>
<tr>
  <td>ignoreWhitelist</td>
  <td><ul><li><code>true</code>: Reserve slot players will <b>NOT</b> be kicked</li><li><code>false</code>: Reserve slot players <b>WILL</b> be kicked</li></ul></td>
  <td><code>false</code></td>
  <td></td>
</tr></table>
</details>

<details>
<summary>AutoTKWarn</summary>
<h2>AutoTKWarn</h2>
<p>The <code>AutoTkWarn</code> plugin will automatically warn players with a message when they teamkill.</p>
<h3>Options</h3>
<table>
<tr>
  <td>Option</td>
  <td>Description</td>
  <td>Default</td>
  <td>Example</td>
</tr>
<tr>
  <td>attackerMessage</td>
  <td>The message to warn attacking players with.</td>
  <td><code>Please apologise for ALL TKs in ALL chat!</code></td>
  <td></td>
</tr>
<tr>
  <td>victimMessage</td>
  <td>The message that will be sent to the victim.</td>
  <td><code>null</code></td>
  <td><code>You were killed by your own team.</code></td>
</tr></table>
</details>

<details>
<summary>DiscordAdminBroadcast</summary>
<h2>DiscordAdminBroadcast</h2>
<p>The <code>DiscordAdminBroadcast</code> plugin will send a copy of admin broadcasts made in game to a Discord channel.</p>
<h3>Options</h3>
<table>
<tr>
  <td>Option</td>
  <td>Description</td>
  <td>Default</td>
  <td>Example</td>
</tr>
<tr>
  <td>channelID</td>
  <td>The ID of the channel to log admin broadcasts to.</td>
  <td><code>null</code></td>
  <td><code>112233445566778899</code></td>
</tr>
<tr>
  <td>color</td>
  <td>The color of the embed.</td>
  <td><code>16761867</code></td>
  <td></td>
</tr></table>
</details>

<details>
<summary>DiscordClient</summary>
<h2>DiscordClient</h2>
<p>Maintains a connection to a discord bot.
Other plugins should depend on this to share a single connection.</p>
<h3>Options</h3>
<table>
<tr>
  <td>Option</td>
  <td>Description</td>
  <td>Default</td>
  <td>Example</td>
</tr>
<tr>
  <td>APIkey</td>
  <td>Discord API key for your bot.</td>
  <td>❌ Must Specify</td>
  <td><code>123456789123456789</code></td>
</tr>
<tr>
  <td>DefaultChannelID</td>
  <td>Unless otherwise specified all messages will go to this channel.</td>
  <td><code>null</code></td>
  <td><code>123456789123456789</code></td>
</tr></table>
</details>

<details>
<summary>FogOfWar</summary>
<h2>FogOfWar</h2>
<p>The <code>FogOfWar</code> plugin can be used to automate setting fog of war mode.</p>
<h3>Options</h3>
<table>
<tr>
  <td>Option</td>
  <td>Description</td>
  <td>Default</td>
  <td>Example</td>
</tr>
<tr>
  <td>mode</td>
  <td>Fog of war mode to set.</td>
  <td><code>1</code></td>
  <td></td>
</tr>
<tr>
  <td>delay</td>
  <td>Delay before setting fog of war mode. (seconds)</td>
  <td><code>10</code></td>
  <td></td>
</tr></table>
</details>

<details>
<summary>IntervalBroadcasts</summary>
<h2>IntervalBroadcasts</h2>
<p>The <code>IntervalledBroadcasts</code> plugin allows you to set broadcasts, which will be broadcasted at preset intervals</p>
<h3>Options</h3>
<table>
<tr>
  <td>Option</td>
  <td>Description</td>
  <td>Default</td>
  <td>Example</td>
</tr>
<tr>
  <td>broadcasts</td>
  <td>Messages to broadcast.</td>
  <td>❌ Must Specify</td>
  <td><code>[
  "This server is powered by SquadJS."
]</code></td>
</tr>
<tr>
  <td>interval</td>
  <td>Frequency of the broadcasts in seconds.</td>
  <td><code>300</code></td>
  <td></td>
</tr></table>
</details>

<details>
<summary>SeedingMode</summary>
<h2>SeedingMode</h2>
<p>The <code>SeedingMode</code> plugin broadcasts seeding rule messages to players at regular intervals when the server is below a specified player count. It can also be configured to display "Live" messages when the server goes live.</p>
<h3>Options</h3>
<table>
<tr>
  <td>Option</td>
  <td>Description</td>
  <td>Default</td>
  <td>Example</td>
</tr>
<tr>
  <td>interval</td>
  <td>Frequency of seeding messages in seconds.</td>
  <td><code>150</code></td>
  <td></td>
</tr>
<tr>
  <td>seedingThreshold</td>
  <td>Player count required for server not to be in seeding mode.</td>
  <td><code>50</code></td>
  <td></td>
</tr>
<tr>
  <td>seedingMessage</td>
  <td>Seeding message to display.</td>
  <td><code>Seeding Rules Active! Fight only over the middle flags! No FOB Hunting!</code></td>
  <td></td>
</tr>
<tr>
  <td>liveEnabled</td>
  <td>Enable "Live" messages for when the server goes live.</td>
  <td><code>true</code></td>
  <td></td>
</tr>
<tr>
  <td>liveThreshold</td>
  <td>Player count required for "Live" messages to not be displayed.</td>
  <td><code>52</code></td>
  <td></td>
</tr>
<tr>
  <td>liveMessage</td>
  <td>Message to display when match is no longer seeding.</td>
  <td><code>Live!</code></td>
  <td></td>
</tr>
<tr>
  <td>waitOnNewGames</td>
  <td>Should the plugin wait to be executed on NEW_GAME event.</td>
  <td><code>true</code></td>
  <td></td>
</tr>
<tr>
  <td>waitTimeOnNewGame</td>
  <td>The time to wait before check player counts in seconds.</td>
  <td><code>30</code></td>
  <td></td>
</tr></table>
</details>

<details>
<summary>SequelizeClient</summary>
<h2>SequelizeClient</h2>
<p>Used to create clients for a variety of databases.
Intended to be used as a connector for other plugins.

The connector should be configured using any of Sequelize's single argument configuration options.
For example:
```json
  "mysql": "mysql://user:pass@example.com:5432/dbname"
```

or:
```json
  "sqlite": {
      "dialect": "sqlite",
      "storage": "path/to/database.sqlite"
  }
```

See [Sequelize's documentation](https://sequelize.org/master/manual/getting-started.html#connecting-to-a-database) for more details.</p>
<h3>Options</h3>
<table>
<tr>
  <td>Option</td>
  <td>Description</td>
  <td>Default</td>
  <td>Example</td>
</tr>
<tr>
  <td>databaseURI</td>
  <td>URI for the database this client will connect to.</td>
  <td>❌ Must Specify</td>
  <td><code>sqlite:database.sqlite</code></td>
</tr></table>
</details>

<br>

## Statement on Accuracy
Some information SquadJS collects from Squad servers was never intended or designed to be collected. As a result, it is impossible for any framework to collect the same information with 100% accuracy. SquadJS aims to get as close as possible to that figure, however, it acknowledges that this is not possible in some specific scenarios.

Below is a list of scenarios we know may cause some information to be inaccurate:
* Use of Realtime Server and Player Information - Since some events
* SquadJS Restarts - If SquadJS is started during an active Squad game some information will be lost or not collected correctly.
* Duplicated Player Names - If two or more players have the same name then SquadJS will be unable to identify them in the logs. Be on the watch for groups of players who try to abuse this in order to TK or complete other malicious actions without being detected by SquadJS plugins.

## Versions and Releases
Whilst installing SquadJS you may do the following to obtain slightly different versions:
* Download the [latest release](https://github.com/Team-Silver-Sphere/SquadJS/releases/latest) - To get the latest **stable** version of SquadJS.
* Download/clone the [`master` branch](https://github.com/Team-Silver-Sphere/SquadJS/) - To get the most up to date version of SquadJS.

All changes proposed to SquadJS will be merged into the `master` branch prior to being released in the next stable version to allow for a period of larger-scale testing to occur. Therefore, we only recommend individuals who are willing to update regularly and partake in testing/bug reporting use the `master` branch. Please note, updates to the `master` branch will not be advertised in the SquadJS startup information, however, notifications of merged pull requests into the `master` branch may be found in our [Discord](https://discord.gg/9F2Ng5C). Once the `master` branch is deemed stable a release will be published and advertised via the SquadJS startup information and our [Discord](https://discord.gg/9F2Ng5C).

Releases will be given a version number with the format `v{major}.{minor}.{patch}`, e.g. `v3.1.4`. Changes to `{major}`/`{minor}`/`{patch}` will imply the following:
* `{major}` - The release contains a new/updated feature that is (potentially) breaking, e.g. changes to event outputs that may cause custom plugins to break.
* `{minor}` - The release contains a new/updated feature.
* `{patch}` - The release contains a bug fix.

Please note, `{minor}`/`{patch}` releases may still break SquadJS installations, however, this may be prevented with configuration changes and should not require custom plugins to be updated.

Release version numbers and changelogs are managed by [Release Drafter](https://github.com/marketplace/actions/release-drafter) which relies on the appropriate labels being applied to pull requests. Version numbers are updated in the `package.json` file manually prior to publishing the release draft.

The above policy was written and put into effect after the release of SquadJS v2.0.5. A major version bump to SquadJS v3.0.0 was made to signify this policy taking affect and to draw a line under the previous poor management of releases and version numbers.

## Credits
SquadJS would not be possible without the support of so many individuals and organisations. Our thanks goes out to:
* [SquadJS's contributors](https://github.com/Team-Silver-Sphere/SquadJS/graphs/contributors).
* [Thomas Smyth's GitHub sponsors](https://github.com/sponsors/Thomas-Smyth).
* subtlerod for proposing the initial log parsing idea, helping to design the log parsing process and for providing multiple servers to test with.
* Shanomac99 and the rest of the Squad Wiki team for providing us with [layer information](https://github.com/Squad-Wiki-Editorial/squad-wiki-pipeline-map-data).
* Fourleaf, Mex, various members of ToG / ToG-L and others that helped to stage logs and participate in small scale tests.
* Various Squad servers/communities for participating in larger scale tests and for providing feedback on plugins.
* Everyone in the [Squad RCON Discord](https://discord.gg/9F2Ng5C) and others who have submitted bug reports, suggestions, feedback and provided logs.