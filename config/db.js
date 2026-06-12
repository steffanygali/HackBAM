// config/db.js
const mysql = require('mysql2');

// Creamos un pool de conexiones utilizando la versión basada en Promesas
const pool = mysql.createPool({
  host: 'localhost',          // O la IP de tu servidor MySQL
  user: 'root',               // Tu usuario de MySQL
  password: '12345678',   // Pon aquí la contraseña de tu base de datos
  database: 'museo_rietberg', // El nombre exacto que veo en tu captura de phpMyAdmin
  waitForConnections: true,
  connectionLimit: 10,        // Máximo de conexiones simultáneas en el pool
  queueLimit: 0
});

// Exportamos el pool con soporte de promesas (.promise())
module.exports = pool.promise();