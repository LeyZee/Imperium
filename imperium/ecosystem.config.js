module.exports = {
  apps: [{
    name: 'imperium',
    script: 'backend/server.js',
    instances: 1,
    env: {
      NODE_ENV: 'development',
      PORT: 3001
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    max_memory_restart: '500M'
  }]
};
