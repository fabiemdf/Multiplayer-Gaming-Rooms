// pm2 process manager configuration
// Usage:
//   npm install -g pm2
//   pm2 start ecosystem.config.js --env production
//   pm2 save && pm2 startup

module.exports = {
  apps: [
    {
      name:             'gaming-rooms',
      script:           'server.js',
      instances:        'max',      // one worker per CPU core
      exec_mode:        'cluster',  // share port across workers
      watch:            false,

      // Restart policy
      max_restarts:     10,
      restart_delay:    2000,       // ms between restarts
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
        // Set ALLOWED_ORIGINS in your actual environment or .env file
      },

      // Log files
      out_file:         './logs/out.log',
      error_file:       './logs/error.log',
      log_date_format:  'YYYY-MM-DD HH:mm:ss Z',
      merge_logs:       true,
    }
  ]
};
