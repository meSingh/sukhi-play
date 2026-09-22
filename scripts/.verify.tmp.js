const { seedProfile } = require('./seed-profile');
const { spawnSync } = require('node:child_process');
const { dir } = seedProfile({
  prefix: 'sukhi-verify-',
  ids: ['musiclab'],
  extraApps: [{
    id: 'sharedpiano', title: 'Shared Piano',
    url: 'https://musiclab.chromeexperiments.com/Shared-Piano/',
    shape: 'note', color: '#3b82f6', enabled: true,
    allowHosts: ['chromeexperiments.com', 'appspot.com', 'googleapis.com',
                 'gstatic.com', 'firebaseio.com', 'tambien.github.io'],
    denyHosts: [], blockAds: true, permissions: ['microphone']
  }]
});
const r = spawnSync(require('electron'), ['.', '--check=sharedpiano', `--user-data-dir=${dir}`], {
  cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, CHECK_SECONDS: '20' }
});
process.stdout.write(r.stdout || '');
