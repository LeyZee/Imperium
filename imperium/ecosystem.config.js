module.exports = {
  apps: [{
    name: 'imperium',
    script: 'backend/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_restarts: 10,
    restart_delay: 5000,
    env: {
      NODE_ENV: 'development',
      PORT: 3001
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    max_memory_restart: '500M',
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    merge_logs: true,
    // Log rotation: 50MB max par fichier, 10 fichiers max, compression
    max_size: '50M',
    retain: 10,
    compress: true,
    // Restart automatique si pas de réponse après 8s
    listen_timeout: 8000,
    kill_timeout: 5000,
    // Exponential backoff sur restart
    exp_backoff_restart_delay: 1000,
  }]
};
