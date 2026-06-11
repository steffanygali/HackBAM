const express = require('express');
const router = express.Router();
const APIVIEW = require('../views/api-view')

router.get('/', APIVIEW.inicio);
router.get('/objects',APIVIEW.obtenerTodos);
router.get('/wiki/:title',APIVIEW.wiki);
router.get('/regions',APIVIEW.regions);


module.exports = router;