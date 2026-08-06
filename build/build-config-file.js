import SquadServerFactory from '../src/core/factory.js';

console.log('Building config...');
SquadServerFactory.buildConfigFile()
  .then(() => {
    console.log('Done.');
    return;
  })
  .catch(console.log);
