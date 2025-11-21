module.exports = {
  apps: [
    {
      name: 'nestjs',
      script: 'dist/main.js',
      watch: false,
      env: {
        PORT: 3000,
        NODE_ENV: 'production',

        DB_HOST: 'localhost',
        DB_PORT: 3306,
        DB_USER: 'root',
        DB_PASSWORD: '0518',
        DB_NAME: 'gas_monitoring_system',

        JWT_SECRET: 'tu_clave_secreta_super_segura_cambiar_en_produccion',
        JWT_EXPIRES_IN: '24h',

        MAIL_HOST: 'smtp.gmail.com',
        MAIL_PORT: 587,
        MAIL_USER: 'johan05182002.com@gmail.com',
        MAIL_PASSWORD: 'vxmlnbtmvorpkjee',
        MAIL_FROM: 'Sistema de Monitoreo de Gas <noreply@gascaqueta.com>',

        WS_PORT: 3001,

        MOCK_SENSOR_ENABLED: true,
        DEFAULT_SENSOR_READING_INTERVAL: 60000,

        COMPANY_NAME: 'Gas Caqueta',
        COMPANY_EMAIL: 'soporte@gascaqueta.com',
        COMPANY_PHONE: '+52 1234567890'
      }
    }
  ]
}
