module.exports = {
  apps: [{
    name: 'saudedotrabalho',
    script: './dist/index.js',
    cwd: '/var/www/saudedotrabalho',
    env_file: '/var/www/saudedotrabalho/.env',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      DATABASE_URL: 'mysql://saudeapp:SaudeApp2024%40%23@localhost:3306/saudedotrabalho',
      JWT_SECRET: 'saudedotrabalho_jwt_secret_2024_super_secure_key',
      VITE_APP_ID: 'saudedotrabalho'
    }
  }]
}
