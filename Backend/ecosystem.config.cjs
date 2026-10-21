// PM2 config for the WorkNear backend.
// Usage (from Backend/ after `npm run build`):  pm2 start ecosystem.config.cjs
// Must stay .cjs because package.json has "type": "module".
module.exports = {
  apps: [
    {
      name: 'worknear-api',
      cwd: __dirname,
      script: 'dist/server.js',
      node_args: '--env-file=.env --enable-source-maps',
      exec_mode: 'fork',
      instances: 1, // keep 1 unless REDIS_ENABLED=true (Socket.IO needs Redis across instances)
      max_memory_restart: '600M',
      kill_timeout: 12000, // server shuts down gracefully within 10 s
      time: true, // timestamps in pm2 logs
    },
  ],
};
