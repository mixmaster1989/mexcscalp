module.exports = {
  apps: [
    {
      name: 'mexc-integrated-trading',
      script: 'dist/main.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      },
      log_file: './logs/pm2-mexc-integrated.log',
      time: true,
      error_file: './logs/pm2-mexc-integrated-error.log',
      out_file: './logs/pm2-mexc-integrated-out.log',
      merge_logs: true,
      exec_mode: 'fork',
      restart_delay: 5000,
      kill_timeout: 10000,
      shutdown_with_message: true
    },
    {
      name: 'mexc-grid-bot',
      script: 'node_modules/ts-node/dist/bin.js',
      args: '-r dotenv/config src/main-grid.ts',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        SYMBOL: 'ETHUSDC'
      },
      log_file: './logs/pm2-mexc-grid.log',
      time: true,
      error_file: './logs/pm2-mexc-grid-error.log',
      out_file: './logs/pm2-mexc-grid-out.log',
      merge_logs: true,
      exec_mode: 'fork',
      restart_delay: 5000
    }
  ]
};
