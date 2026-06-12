// views/api-view.js
const db = require('../config/db'); 

// Ruta base de prueba
exports.inicio = (req, res) => {
  res.json({ mensaje: 'API funcionando con Base de Datos SQL Real (Sin Coordenadas)' });
};

// ------------------------------------------------------------
// 1. OBTENER TODOS
// ------------------------------------------------------------
exports.obtenerTodos = async (req, res) => {
  try {
    const query = `
      SELECT id, url_objeto, titulo, autor, lugar_origen, estilo_cultura, fecha, 
             tipo_objeto, material_tecnica, numero_inventario, dimensiones, creditos, 
             otras_denominaciones, imagen_url 
      FROM objetos
    `;
    const [filas] = await db.query(query);

    const archivos = filas.map(f => ({
      id: f.id,
      titulo: f.titulo || 'Sin título',
      wikiTitle: f.numero_inventario || '', 
      url: f.imagen_url,                    
      year: f.fecha ? CAST_YEAR_NATIVO(f.fecha) : null, 
      yearRaw: f.fecha,                     
      region: f.lugar_origen || 'Perú', 
      descripcion: `Cultura: ${f.estilo_cultura || 'Desconocida'}. Material/Técnica: ${f.material_tecnica || 'N/A'}. Dimensiones: ${f.dimensiones || 'N/A'}`,
      coordinates: [-75.0152, -9.1900]  // Se genera en JS, limpio de SQL
    }));

    res.json({ 
      categoria: "Anne-Marie und Caspar Reinhart Collection at Museum Rietberg, Zürich", 
      total: archivos.length, 
      archivos 
    });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ message: 'Error al obtener los datos desde SQL' });
  }
};

// ------------------------------------------------------------
// 2. FILTRAR POR AÑO
// ------------------------------------------------------------
exports.obtenerPorAnio = async (req, res) => {
  try {
    const year = Number(req.params.year);
    if (isNaN(year)) return res.status(400).json({ message: 'Año inválido' });

    const sigloFin = year + 99;

    const query = `
      SELECT id, url_objeto, titulo, lugar_origen, estilo_cultura, fecha, material_tecnica, dimensiones, creditos, imagen_url 
      FROM objetos
      WHERE fecha >= ? AND fecha <= ?
    `;
    const [filas] = await db.query(query, [year, sigloFin]);

    const archivos = filas.map(f => ({
      id: f.id,
      titulo: f.titulo,
      wikiTitle: f.numero_inventario || '',
      url: f.imagen_url,
      year: Number(f.fecha) || year,
      yearRaw: f.fecha,
      region: f.lugar_origen,
      descripcion: `Cultura: ${f.estilo_cultura}. Técnica: ${f.material_tecnica}`,
      coordinates: [-75.0152, -9.1900]
    }));

    res.json({ year, total: archivos.length, archivos });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ message: 'Error al filtrar por año en SQL' });
  }
};

// ------------------------------------------------------------
// 3. OBTENER DESCONOCIDOS
// ------------------------------------------------------------
exports.obtenerDesconocidos = async (req, res) => {
  try {
    const query = `
      SELECT id, url_objeto, titulo, lugar_origen, estilo_cultura, fecha, material_tecnica, dimensiones, creditos, imagen_url 
      FROM objetos
      WHERE fecha IS NULL OR fecha = 'NULL' OR fecha = ''
    `;
    const [filas] = await db.query(query);

    const archivos = filas.map(f => ({
      id: f.id,
      titulo: f.titulo,
      wikiTitle: f.numero_inventario || '',
      url: f.imagen_url,
      year: null,
      yearRaw: f.fecha,
      region: f.lugar_origen,
      descripcion: `Cultura: ${f.estilo_cultura}. Técnica: ${f.material_tecnica}`,
      coordinates: [-75.0152, -9.1900]
    }));

    res.json({ total: archivos.length, archivos });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ message: 'Error al obtener desconocidos desde SQL' });
  }
};

// ------------------------------------------------------------
// 4. BUSCADOR
// ------------------------------------------------------------
exports.buscar = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ total: 0, archivos: [] });

    const query = `
      SELECT id, url_objeto, titulo, lugar_origen, estilo_cultura, fecha, material_tecnica, dimensiones, creditos, imagen_url, numero_inventario
      FROM objetos
      WHERE LOWER(IFNULL(titulo, '')) LIKE LOWER(?) 
         OR LOWER(IFNULL(lugar_origen, '')) LIKE LOWER(?) 
         OR LOWER(IFNULL(estilo_cultura, '')) LIKE LOWER(?)
         OR LOWER(IFNULL(material_tecnica, '')) LIKE LOWER(?)
    `;
    const patronBusqueda = `%${q}%`;
    const [filas] = await db.query(query, [patronBusqueda, patronBusqueda, patronBusqueda, patronBusqueda]);

    const archivos = filas.map(f => ({
      id: f.id,
      titulo: f.titulo,
      wikiTitle: f.numero_inventario || '',
      url: f.imagen_url,
      year: f.fecha ? parseInt(f.fecha) : null,
      yearRaw: f.fecha,
      region: f.lugar_origen,
      descripcion: `Cultura: ${f.estilo_cultura}. Técnica: ${f.material_tecnica}. Inv: ${f.numero_inventario}`,
      coordinates: [-75.0152, -9.1900]
    }));

    res.json({ query: q, total: archivos.length, archivos });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ message: 'Error en el motor de búsqueda SQL' });
  }
};

// ------------------------------------------------------------
// 5. WIKI INDIVIDUAL
// ------------------------------------------------------------
exports.wiki = async (req, res) => {
  try {
    const title = req.params.title;
    if (!title) return res.status(400).json({ message: 'Se requiere identificador/inventario' });

    const query = `SELECT imagen_url FROM objetos WHERE numero_inventario = ? OR titulo = ? LIMIT 1`;
    const [filas] = await db.query(query, [title, title]);

    if (filas.length > 0) {
      return res.json({ url: filas[0].imagen_url });
    }

    res.status(404).json({ message: 'Imagen no encontrada con el inventario provisto' });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ message: 'Error al obtener la imagen' });
  }
};

// ------------------------------------------------------------
// 6. PROXY DE IMÁGENES
// ------------------------------------------------------------
exports.imageProxy = async (req, res) => {
  try {
    const imageUrl = req.query.url;
    if (!imageUrl) return res.status(400).json({ message: 'URL requerida' });

    const response = await fetch(imageUrl, {
      headers: { 'User-Agent': 'MesoMapBot/1.0 (educational project)' }
    });
    if (!response.ok) return res.status(response.status).json({ message: 'Error al obtener la imagen externa' });

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ message: 'Error en el proxy de imagen' });
  }
};

// ------------------------------------------------------------
// 7. REGIONES
// ------------------------------------------------------------
exports.regions = async (req, res) => {
  try {
    const query = `SELECT DISTINCT lugar_origen FROM objetos WHERE lugar_origen IS NOT NULL AND lugar_origen != 'NULL'`;
    const [filas] = await db.query(query);
    const listaRegiones = filas.map(f => f.lugar_origen);
    
    res.json({ regions: listaRegiones });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ message: 'Error al obtener las regiones' });
  }
};

// Función auxiliar para parsear años
function CAST_YEAR_NATIVO(fechaStr) {
  if (!fechaStr) return null;
  const matches = fechaStr.match(/\d{3,4}/g);
  if (matches && matches.length > 0) {
    if (matches.length >= 2) {
      return Math.round((parseInt(matches[0]) + parseInt(matches[matches.length - 1])) / 2);
    }
    return parseInt(matches[0]);
  }
  return null;
}