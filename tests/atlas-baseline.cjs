// Permanent atlas positions. As the map grows, scripts/build_galaxy.cjs packs clusters apart, so a cluster can move
// as a whole; every word in the committed baseline keeps its cluster, its depth and its exact offset from the centre.
const fs = require('fs'), path = require('path');
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, '../scripts/galaxy/layout-base.json'), 'utf8'));
module.exports = data => p => {
  const was = baseline.clusters[p[4]], now = data.clusters[p[4]];
  return [p[0], p[1] + now.x - was.x, p[2] + now.y - was.y, p[3], p[4]];
};
