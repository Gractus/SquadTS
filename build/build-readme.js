import SquadServerFactory from '../src/core/factory.js';

console.log('Building readme...');
SquadServerFactory.buildReadmeFile()
  .then(() => {
    console.log('Done.');
    return;
  })
  .catch(console.log);
