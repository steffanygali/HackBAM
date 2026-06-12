const express = require('express');
const morgan  = require('morgan');
const cors    = require('cors');
const app = express();
const port = 3000;

app.use(cors());

// Middleware para parsear JSON
app.use(express.json());
app.use(morgan('dev'));

// Ejemplo de ruta GET
app.use('/api', require('./routes/api'));
// Iniciar servidor
app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});