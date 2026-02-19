// pm2 process manager configuration
// Usage:
//   npm install -g pm2
//   pm2 start ecosystem.config.js --env production
//   pm2 save && pm2 startup
//
// Scaling notes:
//   Default: single instance (safe — rooms/users live in process memory).
//   To scale horizontally:
//     1. Set REDIS_URL so the Socket.IO Redis adapter is activated.
//     2. Configure nginx with ip_hash sticky sessions (keeps each room's
//        players on the same worker; the adapter syncs cross-worker broadcasts).
//     3. Change instances to 'max' and exec_mode to 'cluster'.

module.exports = {
  apps: [
    {
      name:             'gaming-rooms',
      script:           'server.js',
      instances:        1,           // increase to 'max' when REDIS_URL is set
      exec_mode:        'fork',      // change to 'cluster' when scaling

      watch:            false,

      // Restart policy
      max_restarts:     10,
      restart_delay:    2000,
      max_memory_restart: '512M',

      // Environment – development
      env: {
        NODE_ENV:       'development',
        PORT:           3000,
        LOG_LEVEL:      'debug',
        ALLOWED_ORIGINS:'http://localhost:3000',
      },

      // Environment – production (activate with --env production)
      env_production: {
        NODE_ENV:       'production',
        PORT:           3000,
        LOG_LEVEL:      'info',
        // Set these in your actual environment or .env file:
        // ALLOWED_ORIGINS=https://yourdomain.com
        // REDIS_URL=redis://localhost:6379
      },

      // Log files (written to ./logs/ which is gitignored)
      out_file:         './logs/out.log',
      error_file:       './logs/error.log',
      log_date_format:  'YYYY-MM-DD HH:mm:ss Z',
      merge_logs:       true,
    }
  ]
};
