import fs from 'fs'
import path from 'path'

import { loadPlugins } from '../core/plugin-manager.js'

const CURRENT_DIR = import.meta.dirname

async function buildReadmeFile() {
  const plugins = await loadPlugins()

  plugins.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))

  const pluginInfo = []

  for (const plugin of plugins) {
    pluginInfo.push(
      `<details>
<summary>${plugin.name}</summary>
<h2>${plugin.name}</h2>
<p>${plugin.description}</p>
${
  Object.keys(plugin.optionSpec).length > 0
    ? `<h3>Options</h3>
<table>
<tr>
  <td>Option</td>
  <td>Description</td>
  <td>Default</td>
  <td>Example</td>
</tr>
${Object.entries(plugin.optionSpec)
  .map(
    ([optionName, option]) =>
      `<tr>
  <td>${optionName}</td>
  <td>${option.description}</td>
  <td>${
    option.default === undefined
      ? '\u274c Must Specify'
      : `<code>${
          typeof option.default === 'object'
            ? JSON.stringify(option.default, null, 2)
            : option.default
        }</code>`
  }</td>
  <td>${
    option.example === undefined
      ? ''
      : `<code>${
          typeof option.example === 'object'
            ? JSON.stringify(option.example, null, 2)
            : option.example
        }</code>`
  }</td>
</tr>`
  )
  .join('\n')}</table>`
    : null
}
</details>`
    )
  }

  const pluginInfoText = pluginInfo.join('\n\n')

  const templatePath = path.resolve(
    CURRENT_DIR,
    '../../templates/readme-template.md'
  )
  const template = fs.readFileSync(templatePath, 'utf8')

  const readmePath = path.resolve(CURRENT_DIR, '../../README.md')
  const readme = template.replace(/\/\/PLUGIN-INFO\/\//, pluginInfoText)

  fs.writeFileSync(readmePath, readme)
}

console.log('Building readme...')
await buildReadmeFile()
console.log('Done.')
