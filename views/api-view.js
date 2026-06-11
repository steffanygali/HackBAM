const BASE_URL = 'https://commons.wikimedia.org/w/api.php';
const category =  "Anne-Marie und Caspar Reinhart Collection at Museum Rietberg, Zürich"; 



exports.inicio = (req,res) =>{
    // en esta parte solo se maeneja para ver si la api funcuina 
    res.json({ mensaje: 'API funcionando' });
};

// buscamos un unico por categoria
exports.obtenerTodos = async (req, res) => {

  try {

    const params = new URLSearchParams({
      action: 'query',
      list: 'categorymembers',
      cmtitle: `Category:${category}`,
      cmtype: 'file',
      cmlimit: '200',
      format: 'json',
      origin: '*',
    });
    // obtenemos los archivos de la categoría
    const respuesta = await fetch(`${BASE_URL}?${params}`);
    const data = await respuesta.json();

  
    if (!data.query || !data.query.categorymembers) {
      return res.status(404).json({ message: 'Categoría no encontrada' });
    }

    // Juntamos todos los títulos en un solo string separado por 
    const todosLosMiembros = data.query.categorymembers;
    const archivosFinales = [];

    // 2. LA SOLUCIÓN: Procesamos los títulos en grupos de máximo 50
    for (let i = 0; i < todosLosMiembros.length; i += 50) {
      // Cortamos un pedazo del array de 50 en 50 (Ej: 0-50, luego 50-100...)
      const bloque = todosLosMiembros.slice(i, i + 50);
      const titulosBloque = bloque.map(a => a.title).join('|');

      const paramsInfo = new URLSearchParams({
        action: 'query',
        titles: titulosBloque, 
        prop: 'imageinfo',
        iiprop: 'url',
        format: 'json',
        origin: '*',
      });
    

      const respuestaInfo = await fetch(`${BASE_URL}?${paramsInfo}`);
      const dataInfo = await respuestaInfo.json();

      if (dataInfo.query?.pages) {
        const archivosBloque = Object.values(dataInfo.query.pages).map(p => ({
          id: p.pageid,
          titulo: p.title ? p.title.replace('File:', '') : 'Sin título',
          url: p.imageinfo?.[0]?.url || null,
        }));

        // Guardamos los archivos de este bloque en nuestro arreglo final
        archivosFinales.push(...archivosBloque);
      }
    }

    res.json({ 
      categoria: category, 
      total: archivosFinales.length, 
      archivos: archivosFinales 
    });

  } catch (e) {
    console.error(e.message);
    res.status(500).json({ message: 'Error al encontrar el dato' });
  }
};

exports.wiki = async (req,res) =>{
    const title = req.params.title;

    if(!title){
        return res.status(404).json({ message: 'Se requiere titulo' });
    }

    const fullTitle = title.startsWith('File:') ? title : `File:${title}`;

    const paramsInfo = new URLSearchParams({
        action: 'query',
        titles: fullTitle,
        prop: 'imageinfo',
        iiprop: 'url',
        format: 'json',
        origin: '*',
    });

    const respuestaInfo = await fetch(`${BASE_URL}?${paramsInfo}`);
    const linkImagen = await respuestaInfo.json();

    const paginas = linkImagen.query?.pages;

    if (paginas) {
        const primeraPagina = Object.values(paginas)[0];
        
        // Extraemos de forma segura la URL del array 'imageinfo'
        const urlImagen = primeraPagina?.imageinfo?.[0]?.url;

        if (urlImagen) {
            // Retornamos únicamente el link de la imagen
            return res.json({ url: urlImagen });
        }
    }
};

exports.regions = (req,res) =>{

}

