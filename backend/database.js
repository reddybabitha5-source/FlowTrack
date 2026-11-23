
const mysql = require("mysql2/promise");
require("dotenv").config();

// =====================================
// DATABASE CONFIGURATION
// =====================================

const requiredVariables = [
    "DB_HOST",
    "DB_USER",
    "DB_PASSWORD",
    "DB_NAME"
];

for (const variable of requiredVariables) {
    if (process.env[variable] === undefined) {
        throw new Error(
            `Missing ${variable} in backend/.env file`
        );
    }
}

// =====================================
// MYSQL CONNECTION POOL
// =====================================

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),

    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 10,
    idleTimeout: 60000,
    queueLimit: 0,

    enableKeepAlive: true,
    keepAliveInitialDelay: 0,

    charset: "utf8mb4",

ssl: {
    rejectUnauthorized: false
}
});

// =====================================
// TEST DATABASE CONNECTION
// =====================================

async function testConnection() {
    let connection;

    try {
        connection = await pool.getConnection();

        await connection.query("SELECT 1");

        console.log("--------------------------------");
        console.log("MySQL DATABASE CONNECTED");
        console.log(`Database: ${process.env.DB_NAME}`);
        console.log("Connection pool is ready");
        console.log("--------------------------------");

    } catch (error) {
        console.error("--------------------------------");
        console.error("MYSQL DATABASE CONNECTION FAILED");
        console.error(error.message);
        console.error("--------------------------------");

    } finally {
        if (connection) {
            connection.release();
        }
    }
}

// =====================================
// EXPORT DATABASE POOL
// =====================================

pool.testConnection = testConnection;

module.exports = pool;
