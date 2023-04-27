require('dotenv').config();

module.exports = {
    allowedOrigins: process.env.ALLOWED_ORIGINS.split(' '),
    port: process.env.PORT,
    dbConnectionStr: process.env.DB_CONN_STR,
    JwtSecret: process.env.JWT_SECRET
}