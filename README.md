#  MESO MAP — Explorador Histórico de Mesoamérica

> Mapa interactivo que visualiza objetos arqueológicos del Museo Rietberg de Zúrich sobre los países de Mesoamérica, filtrados por período histórico y con datos en tiempo real desde Wikimedia Commons.

---

## Índice

1. [Descripción del proyecto](#descripción-del-proyecto)
2. [Arquitectura general](#arquitectura-general)
3. [Estructura de carpetas](#estructura-de-carpetas)
4. [Instalación y puesta en marcha](#instalación-y-puesta-en-marcha)
5. [Backend — API REST](#backend--api-rest)
6. [Frontend — React](#frontend--react)
7. [Flujo de datos](#flujo-de-datos)
8. [Variables de entorno](#variables-de-entorno)
9. [Tecnologías utilizadas](#tecnologías-utilizadas)
10. [Decisiones de diseño](#decisiones-de-diseño)
11. [Problemas conocidos y soluciones](#problemas-conocidos-y-soluciones)
12. [Roadmap](#roadmap)

---

## Descripción del proyecto

**MESO MAP** es una aplicación web full-stack que permite explorar objetos arqueológicos y piezas de arte precolombino de la *Colección Anne-Marie y Caspar Reinhart* del Museo Rietberg (Zúrich), visualizándolos geográficamente sobre un mapa interactivo de Mesoamérica.

El usuario puede:
- Seleccionar un **período histórico** (400 d.C. – 2000 d.C.) en la línea de tiempo
- Ver qué **países de Mesoamérica** tienen objetos asociados a ese período
- Hacer clic en un país para ver la **galería de objetos** con imágenes y metadata
- **Buscar** objetos por nombre, región o cultura
- Ver el detalle completo de cada objeto: imagen, fecha histórica, lugar de creación y descripción

Los datos se obtienen en tiempo real desde **Wikimedia Commons** a través de su API pública.

---

## Arquitectura general

```
┌─────────────────────────────────────────────────────────┐
│                     NAVEGADOR                           │
│                                                         │
│   React (Vite) — localhost:5173                         │
│   ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌─────────┐  │
│   │ Timeline │ │SearchBar │ │  MesoMap  │ │InfoPanel│  │
│   └──────────┘ └──────────┘ └───────────┘ └─────────┘  │
│                        │                                │
│                   api/api.js                            │
└───────────────────────┼─────────────────────────────────┘
                        │ HTTP
┌───────────────────────▼─────────────────────────────────┐
│              BACKEND Node.js + Express                  │
│              localhost:3001                             │
│                                                         │
│   routes/api.js → views/api-view.js                     │
│                                                         │
│   Cache en memoria (30 min TTL)                         │
└───────────────────────┬─────────────────────────────────┘
                        │ fetch
┌───────────────────────▼─────────────────────────────────┐
│           Wikimedia Commons API                         │
│   commons.wikimedia.org/w/api.php                       │
│                                                         │
│   Categoría: Anne-Marie und Caspar Reinhart             │
│   Collection at Museum Rietberg, Zürich                 │
└─────────────────────────────────────────────────────────┘
```

---

## Estructura de carpetas

```
HackBAMProy/
├── frontend/                        # App React (Vite)
│   ├── src/
│   │   ├── api/
│   │   │   └── api.js               # Funciones de llamada al backend
│   │   ├── components/
│   │   │   ├── Header.jsx           # Título y logo
│   │   │   ├── Timeline.jsx         # Selector de período histórico
│   │   │   ├── SearchBar.jsx        # Búsqueda con debounce
│   │   │   ├── MesoMap.jsx          # Mapa interactivo (react-simple-maps)
│   │   │   ├── InfoPanel.jsx        # Panel lateral derecho
│   │   │   └── CountryModal.jsx     # Modal con galería por país
│   │   ├── context/
│   │   │   └── AppContext.jsx       # Estado global (año, objetos, búsqueda)
│   │   ├── pages/
│   │   │   └── Home.jsx             # Página principal
│   │   ├── App.jsx                  # Router principal
│   │   ├── main.jsx                 # Entry point
│   │   └── index.css                # Estilos globales + fuentes
│   ├── package.json
│   └── vite.config.js
│
└── backend/                         # API Node.js + Express
    ├── app.js                       # Entry point, middlewares, puerto
    ├── routes/
    │   └── api.js                   # Definición de rutas
    ├── views/
    │   └── api-view.js              # Lógica de negocio + llamadas a Wikimedia
    └── package.json
```

---

## Instalación y puesta en marcha

### Prerrequisitos

- Node.js v18 o superior
- npm v9 o superior
- Conexión a internet (para consultar Wikimedia Commons)

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/HackBAMProy.git
cd HackBAMProy
```

### 2. Instalar dependencias del backend

```bash
cd backend
npm install
```

Dependencias del backend:
- `express` — servidor HTTP
- `morgan` — logging de requests
- `cors` — habilita CORS para el frontend

### 3. Instalar dependencias del frontend

```bash
cd ../frontend
npm install
```

Dependencias del frontend:
- `react` + `react-dom` — UI
- `react-router-dom` — enrutamiento
- `react-simple-maps` — mapa SVG interactivo
- `lucide-react` — iconos

### 4. Iniciar el backend

```bash
cd backend
npm run dev
# Servidor en http://localhost:3001
```

>  La **primera carga** tarda ~30 segundos porque consulta Wikimedia para los 200 objetos. Las siguientes son instantáneas gracias al caché de 30 minutos.

### 5. Iniciar el frontend

```bash
cd frontend
npm run dev
# App en http://localhost:5173
```

---

## Backend — API REST

### Base URL
```
http://localhost:3001/api
```

### Endpoints

#### `GET /api`
Verifica que el servidor está activo.

**Respuesta:**
```json
{ "mensaje": "API funcionando" }
```

---

#### `GET /api/objects`
Devuelve todos los objetos de la colección (200 objetos).

**Respuesta:**
```json
{
  "categoria": "Anne-Marie und Caspar Reinhart Collection...",
  "total": 200,
  "archivos": [
    {
      "id": 193647490,
      "titulo": "Museum-Rietberg-Zürich-Inv.Nr.-2025.1162-Gürtel",
      "wikiTitle": "Museum-Rietberg-Zürich-Inv.Nr.-2025.1162-Gürtel.jpg",
      "url": "https://upload.wikimedia.org/...",
      "year": 1235,
      "yearRaw": "entre 1000 y 1470",
      "region": "Perú",
      "descripcion": "Bordüre / Gürtel_Inv.Nr. 2025.1163...",
      "coordinates": [-75.01, -9.19]
    }
  ]
}
```

---

#### `GET /api/objects/year/:year`
Filtra objetos por siglo. `year=1400` devuelve objetos con fecha histórica entre 1400 y 1499.

**Parámetros:**
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `year` | number | Año de inicio del siglo (ej: 400, 500, 1400) |

**Respuesta:**
```json
{
  "year": 1400,
  "total": 12,
  "archivos": [ ... ]
}
```

---

#### `GET /api/objects/unknown`
Devuelve objetos sin fecha histórica identificada.

**Respuesta:**
```json
{
  "total": 45,
  "archivos": [ ... ]
}
```

---

#### `GET /api/search?q=:query`
Busca objetos por título, región o descripción.

**Parámetros:**
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `q` | string | Texto a buscar (ej: "maya", "oaxaca", "gürtel") |

**Respuesta:**
```json
{
  "query": "maya",
  "total": 8,
  "archivos": [ ... ]
}
```

---

#### `GET /api/wiki/:title`
Devuelve la URL de imagen de un archivo de Wikimedia.

**Parámetros:**
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `title` | string | Nombre del archivo (con o sin prefijo `File:`) |

**Respuesta:**
```json
{ "url": "https://upload.wikimedia.org/wikipedia/commons/..." }
```

---

#### `GET /api/image-proxy?url=:imageUrl`
Proxy de imágenes para evitar bloqueos CORS de Wikimedia. El frontend pasa la URL de la imagen y el backend la sirve.

**Parámetros:**
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `url` | string (encoded) | URL completa de la imagen en Wikimedia |

**Respuesta:** Imagen binaria con el `Content-Type` correcto.

---

#### `GET /api/regions`
Lista todas las regiones/lugares reconocidos por el sistema de coordenadas.

---

### Sistema de caché

El backend mantiene un caché en memoria con un TTL de **30 minutos**. Esto evita hacer 200+ llamadas a Wikimedia en cada request.

```
Primera llamada → Wikimedia API (~30s) → Cache
Llamadas siguientes → Cache (< 100ms)
Cada 30 minutos → Cache se invalida automáticamente
```

### Extracción de fechas históricas

El backend lee el **wikitext completo** de cada página para extraer la fecha del campo `| date =` de la plantilla `{{Artwork}}`. Soporta los formatos:

| Formato en Wikimedia | Año extraído |
|----------------------|--------------|
| `entre 1000 y 1470` | 1235 (promedio) |
| `1300-1500` | 1400 (promedio) |
| `ca. 1200` | 1200 |
| `siglo XV` | 1450 |
| `1250` | 1250 |

Años >= 1900 se descartan (son fechas de fotografía, no históricas).

---

## Frontend — React

### Estado global (`AppContext`)

```javascript
{
  selectedYear,    // número o "Desconocido"
  setSelectedYear, // actualiza el año y recarga objetos
  objects,         // array de objetos del período actual
  setObjects,      // actualiza objetos (usado por SearchBar)
  selectedObject,  // objeto seleccionado para detalle
  setSelectedObject,
  search,          // texto de búsqueda actual
  setSearch,
  loading          // boolean — true mientras carga del backend
}
```

### Componentes principales

#### `Timeline.jsx`
Barra horizontal con botones para cada siglo (400 – 2000 + Año Desconocido). Al hacer clic actualiza `selectedYear` en el contexto, lo que dispara la carga de objetos.

#### `SearchBar.jsx`
Input de búsqueda con debounce de 400ms. Mientras el usuario escribe, espera 400ms antes de llamar al backend. Al borrar el texto regresa al filtro por año activo.

#### `MesoMap.jsx`
Mapa SVG usando `react-simple-maps` con topojson de `world-atlas`. Resalta los 8 países de Mesoamérica (México, Guatemala, Belice, Honduras, El Salvador, Nicaragua, Costa Rica, Panamá). Los nombres de países se renderizan como elementos HTML absolutamente posicionados (no como `<Annotation>`) para evitar un bug de React con SVG al re-renderizar.

Al hacer clic en un país abre `CountryModal` con los objetos del contexto filtrados por ese país.

#### `CountryModal.jsx`
Modal flotante con dos vistas:
1. **Galería** — grid 2 columnas con miniaturas de todos los objetos del país en el período seleccionado
2. **Detalle** — imagen grande (via image-proxy), título, fecha histórica, región y descripción

Las imágenes se cargan via `getProxiedImageUrl()` que llama a `/api/image-proxy` para evitar errores CORS de Wikimedia.

#### `InfoPanel.jsx`
Panel lateral derecho que muestra el objeto seleccionado individualmente.

### Funciones de API (`api/api.js`)

```javascript
getObjects()              // Todos los objetos
getObjectsByYear(year)    // Objetos de un siglo
getUnknownObjects()       // Objetos sin fecha
searchObjects(query)      // Búsqueda por texto
getWikiImage(title)       // URL de imagen por título
getProxiedImageUrl(url)   // URL proxeada para cargar imagen
```

---

## Flujo de datos

```
Usuario selecciona año "1400"
        │
        ▼
AppContext.setSelectedYear(1400)
        │
        ▼
useEffect → getObjectsByYear(1400)
        │
        ▼
GET /api/objects/year/1400
        │
        ▼
api-view.js → fetchTodosLosArchivos() [caché]
        │
        ▼
filter: year >= 1400 && year < 1500
        │
        ▼
{ archivos: [...12 objetos...] }
        │
        ▼
AppContext.setObjects([...])
        │
        ▼
MesoMap re-renderiza con nuevos conteos por país
        │
        ▼
Usuario hace clic en "Guatemala"
        │
        ▼
CountryModal abre con objetos de Guatemala
        │
        ▼
Imágenes cargan via /api/image-proxy?url=...
```

---

## Variables de entorno

Actualmente el proyecto no usa `.env`. Las configuraciones están hardcodeadas:

| Archivo | Variable | Valor por defecto |
|---------|----------|------------------|
| `backend/app.js` | Puerto | `3001` |
| `frontend/src/api/api.js` | URL del backend | `http://localhost:3001/api` |
| `backend/views/api-view.js` | TTL del caché | `30 minutos` |

Para producción se recomienda agregar un archivo `.env`:

```env
# backend/.env
PORT=3001
CACHE_TTL_MINUTES=30

# frontend/.env
VITE_API_URL=http://localhost:3001/api
```


## Tecnologías utilizadas

### Backend
| Tecnología | Versión | Uso |
|------------|---------|-----|
| Node.js | v18+ | Runtime |
| Express | ^4.x | Framework HTTP |
| morgan | ^1.x | Logging |
| cors | ^2.x | Manejo de CORS |
| fetch (nativo) | Node 18+ | Llamadas a Wikimedia |

### Frontend
| Tecnología | Versión | Uso |
|------------|---------|-----|
| React | ^18.x | UI |
| Vite | ^5.x | Build tool |
| react-simple-maps | ^3.x | Mapa SVG |
| react-router-dom | ^6.x | Enrutamiento |
| lucide-react | ^0.4x | Iconos |
| Tailwind CSS | ^3.x | Estilos |
| world-atlas | CDN | TopoJSON de países |

### APIs externas
| API | URL | Uso |
|-----|-----|-----|
| Wikimedia Commons | commons.wikimedia.org/w/api.php | Imágenes y metadata |
| world-atlas CDN | cdn.jsdelivr.net/npm/world-atlas@2 | GeoJSON de países |



## Decisiones de diseño

### ¿Por qué Node.js como proxy?
Wikimedia Commons bloquea peticiones directas desde el navegador a sus imágenes (CORS). El backend actúa como proxy añadiendo el header `User-Agent` necesario y retransmitiendo la imagen.

### ¿Por qué caché en memoria y no base de datos?
La colección tiene 200 objetos fijos. No hay escrituras. Un caché en memoria con TTL de 30 minutos es suficiente para un proyecto de hackathon y evita la complejidad de una base de datos.

### ¿Por qué `world-atlas` en lugar de un GeoJSON propio?
`world-atlas@2` es el estándar de react-simple-maps, es liviano (TopoJSON comprimido) y se sirve desde CDN.

### ¿Por qué nombres de países como HTML y no como `<Annotation>`?
`react-simple-maps` tiene un bug al re-renderizar: el componente `<Annotation>/<Text>` interno lanza `removeChild` sobre nodos SVG que React ya movió. La solución es colocar los labels como `div` con `position: absolute` sobre el mapa usando `pointer-events: none`.


## Problemas conocidos y soluciones

| Problema | Causa | Solución |
|----------|-------|----------|
| Primera carga tarda ~30s | 200 requests a Wikimedia | Caché en memoria — subsiguientes son instantáneas |
| `year: 2025` en todos los objetos | Wikimedia devuelve fecha de subida, no histórica | Se lee el wikitext del campo `date` de la plantilla `{{Artwork}}` |
| Imágenes no cargan en el frontend | CORS de Wikimedia | Proxy `/api/image-proxy` en el backend |
| Pantalla negra al cambiar año | Bug `removeChild` de react-simple-maps con `<Annotation>` | Labels como HTML absoluto, sin `<Annotation>` |
| `year: 40` en lugar de `400` | `parseInt` con espacios | Se usa `Number(String(param).trim())` |



## Roadmap

- [ ] Persistencia con base de datos (MongoDB o SQLite) para no depender de Wikimedia en cada arranque
- [ ] Filtro por cultura (Maya, Azteca, Olmeca, etc.)
- [ ] Vista de línea de tiempo visual con los objetos ordenados cronológicamente
- [ ] Modo comparación: ver dos períodos al mismo tiempo
- [ ] Exportar objetos seleccionados como PDF
- [ ] Soporte multilenguaje (ES / EN / DE)
- [ ] Deploy en producción (Railway + Vercel)



## Créditos

- **Datos:** [Wikimedia Commons](https://commons.wikimedia.org) — Colección Anne-Marie und Caspar Reinhart, Museo Rietberg, Zúrich
- **Mapa:** [world-atlas](https://github.com/topojson/world-atlas) por Mike Bostock
- **Proyecto desarrollado en:** HackBAM 2025

