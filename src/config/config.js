require('dotenv').config();

module.exports = {
    development: {
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        host: process.env.DB_HOST,
        dialect: process.env.DB_DIALECT || 'mysql',
        port: process.env.DB_PORT,
        //timezone
        timezone: '+07:00'
    },
    test: {
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        host: process.env.DB_HOST,
        dialect: process.env.DB_DIALECT || 'mysql',
        port: process.env.DB_PORT,
        timezone: '+07:00'
    },
    production: {
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        host: process.env.DB_HOST,
        dialect: process.env.DB_DIALECT || 'mysql',
        port: process.env.DB_PORT,
        timezone: '+07:00'
    },
    // App configuration
    app: {
        baseUrl: process.env.APP_BASE_URL || (process.env.NODE_ENV === 'production' ? 'https://api-oblix.metro-software.com' : 'http://localhost:3000'),
        port: process.env.PORT || 3000
    }
}