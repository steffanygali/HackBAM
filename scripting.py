import requests
import time
import re
import csv
from urllib.parse import quote, unquote
from concurrent.futures import ThreadPoolExecutor, as_completed

# ------------------------------------------------------------
# Helper: Limpiar caracteres extraños para el archivo CSV
# ------------------------------------------------------------
def limpiar_texto_csv(texto):
    if not texto:
        return ""
    # Removemos saltos de línea o tabuladores que puedan alterar las filas del CSV
    return texto.replace("\n", " ").replace("\r", " ").strip()

# ------------------------------------------------------------
# 1. Obtener TODOS los archivos de la categoría (Sin límite)
# ------------------------------------------------------------
def get_all_files(category_title):
    files = []
    continue_token = None
    headers = {'User-Agent': 'MiMapeadorMasivo/1.0 (contacto@ejemplo.com)'}
    while True:
        url = "https://commons.wikimedia.org/w/api.php"
        params = {
            "action": "query",
            "list": "categorymembers",
            "cmtitle": category_title,
            "cmtype": "file",
            "cmlimit": 500,  
            "format": "json"
        }
        if continue_token:
            params["cmcontinue"] = continue_token

        try:
            resp = requests.get(url, params=params, headers=headers, timeout=30)
            if resp.status_code != 200: break
            data = resp.json()
            if "error" in data: break
        except Exception:
            break

        members = data.get("query", {}).get("categorymembers", [])
        for member in members:
            files.append(member["title"])

        if "continue" in data:
            continue_token = data["continue"]["cmcontinue"]
        else:
            break
        time.sleep(0.1)
    return files

# ------------------------------------------------------------
# 2. Obtener URL directa del binario de la imagen (upload.wikimedia.org)
# ------------------------------------------------------------
def get_direct_image_url(file_title, headers):
    url = "https://commons.wikimedia.org/w/api.php"
    params = {
        "action": "query",
        "titles": file_title,
        "prop": "imageinfo",
        "iiprop": "url",
        "format": "json"
    }
    try:
        resp = requests.get(url, params=params, headers=headers, timeout=12)
        if resp.status_code == 200:
            pages = resp.json().get("query", {}).get("pages", {})
            for page_id, page_data in pages.items():
                img_info = page_data.get("imageinfo", [])
                if img_info:
                    return img_info[0].get("url")
    except Exception:
        pass
    filename_clean = file_title.replace("File:", "").replace(" ", "_")
    return f"https://upload.wikimedia.org/wikipedia/commons/7/78/{quote(filename_clean)}"

# ------------------------------------------------------------
# 3. Obtener el ID de Wikidata desde la página del archivo
# ------------------------------------------------------------
def get_wikidata_id_from_file(file_title):
    raw_url = f"https://commons.wikimedia.org/w/index.php?title={quote(file_title)}&action=raw"
    headers = {'User-Agent': 'MiMapeadorMasivo/1.0'}
    try:
        raw_text = requests.get(raw_url, headers=headers, timeout=15).text
        match = re.search(r'{{Art photo\s*\|\s*wikidata\s*=\s*(Q\d+)', raw_text, re.IGNORECASE)
        if match: return match.group(1)
        match2 = re.search(r'\|\s*wikidata\s*=\s*(Q\d+)', raw_text, re.IGNORECASE)
        return match2.group(1) if match2 else None
    except Exception:
        return None

# ------------------------------------------------------------
# Helper: Traducir un QID de país o tipo a texto legible
# ------------------------------------------------------------
def get_label_by_qid(qid, headers):
    url = "https://www.wikidata.org/w/api.php"
    params = {"action": "wbgetentities", "ids": qid, "format": "json", "props": "labels", "languages": "es|en"}
    try:
        resp = requests.get(url, params=params, headers=headers, timeout=10)
        if resp.status_code == 200:
            labels = resp.json().get("entities", {}).get(qid, {}).get("labels", {})
            val = labels.get("es", {}).get("value") or labels.get("en", {}).get("value") or qid
            return limpiar_texto_csv(val)
    except Exception:
        pass
    return qid

# ------------------------------------------------------------
# Helper: Limpiar las fechas raras de Wikidata
# ------------------------------------------------------------
def limpiar_fecha(fecha_raw):
    if not fecha_raw:
        return "Desconocida"
    match = re.search(r'\+(\d{4})|\-(\d{4})', fecha_raw)
    if match:
        ano = match.group(1) or match.group(2)
        ano_limpio = str(int(ano))
        if fecha_raw.startswith('-'):
            return f"{ano_limpio} a.C."
        return f"Ano {ano_limpio}"
    return fecha_raw

# ------------------------------------------------------------
# Helper: Extraer un nombre alternativo limpio del título de archivo
# ------------------------------------------------------------
def limpiar_nombre_archivo(file_title):
    nombre = re.sub(r'^(File:|Archivo:)', '', file_title, flags=re.IGNORECASE)
    nombre = nombre.replace("Museum-Rietberg-Zürich-Inv.Nr.-", "Inv. ")
    nombre = re.sub(r'\.[a-zA-Z0-9]+$', '', nombre)
    nombre = unquote(nombre).replace('_', ' ').replace('-', ' ')
    return limpiar_texto_csv(nombre)

# ------------------------------------------------------------
# 4. Obtener metadatos desde Wikidata con reintentos
# ------------------------------------------------------------
def get_wikidata_metadata_with_retry(qid, file_title, headers, retries=3):
    url = "https://www.wikidata.org/w/api.php"
    params = {"action": "wbgetentities", "ids": qid, "format": "json", "languages": "es|en|de"}
    
    nombre_alternativo = limpiar_nombre_archivo(file_title)
    
    for attempt in range(retries):
        try:
            resp = requests.get(url, params=params, headers=headers, timeout=15)
            if resp.status_code == 200:
                data = resp.json()
                entity = data.get("entities", {}).get(qid)
                if not entity: return nombre_alternativo, "Desconocida", "Desconocido", "Objeto"
                
                labels = entity.get("labels", {})
                name = labels.get("es", {}).get("value") or labels.get("en", {}).get("value") or labels.get("de", {}).get("value")
                
                if not name or name.lower() == "sin nombre":
                    name = nombre_alternativo
                else:
                    name = limpiar_texto_csv(name)
                
                claims = entity.get("claims", {})
                
                # Fecha
                date = "Desconocida"
                if "P571" in claims:
                    for claim in claims["P571"]:
                        if "datavalue" in claim.get("mainsnak", {}):
                            date = limpiar_fecha(claim["mainsnak"]["datavalue"]["value"]["time"])
                            break
                
                # País de origen
                country_qid = None
                for prop in ["P17", "P1071"]:
                    if prop in claims:
                        for claim in claims[prop]:
                            if "datavalue" in claim.get("mainsnak", {}):
                                country_qid = claim["mainsnak"]["datavalue"]["value"]["id"]
                                break
                        if country_qid: break
                
                country_name = get_label_by_qid(country_qid, headers) if country_qid else "Desconocido"
                
                # Tipo de objeto
                obj_type_qid = None
                if "P31" in claims:
                    for claim in claims["P31"]:
                        if "datavalue" in claim.get("mainsnak", {}):
                            obj_type_qid = claim["mainsnak"]["datavalue"]["value"]["id"]
                            break
                obj_type_name = get_label_by_qid(obj_type_qid, headers) if obj_type_qid else "Objeto"
                
                return name, date, country_name, obj_type_name
                
            elif resp.status_code == 429:
                time.sleep((2 ** attempt) * 2)
            else:
                return nombre_alternativo, "Desconocida", "Desconocido", "Objeto"
        except Exception:
            if attempt == retries - 1: return nombre_alternativo, "Desconocida", "Desconocido", "Objeto"
            time.sleep(1)
            
    return nombre_alternativo, "Desconocida", "Desconocido", "Objeto"

# ------------------------------------------------------------
# 🌟 TRABAJADOR INDIVIDUAL (Workers)
# ------------------------------------------------------------
def procesar_un_archivo(args):
    idx, file_title = args
    time.sleep((idx % 10) * 0.15)
    headers = {'User-Agent': 'MiMapeadorMasivo/1.0 (contacto@ejemplo.com)'}
    
    raw_image_url = get_direct_image_url(file_title, headers)
    # Estructura limpia stringificada para que se guarde de forma segura en la celda del CSV
    image_json_str = f'{{"url": "{raw_image_url}"}}'
    
    qid = get_wikidata_id_from_file(file_title)
    if qid:
        name, date, country, obj_type = get_wikidata_metadata_with_retry(qid, file_title, headers)
        return [name, date, country, obj_type, image_json_str]
    else:
        nombre_limpio = limpiar_nombre_archivo(file_title)
        return [nombre_limpio, "Desconocida", "Desconocido", "Objeto", image_json_str]

# ------------------------------------------------------------
# 5. Guardar Resultados en un Archivo CSV estructurado
# ------------------------------------------------------------
def save_to_csv(data_rows, output_file="coleccion_reinhart.csv"):
    headers_csv = ["Nombre / Inventario", "Fecha", "Pais", "Tipo de Objeto", "Estructura Imagen (JSON/Link)"]
    
    try:
        with open(output_file, mode="w", encoding="utf-8", newline="") as archivo:
            escritor = csv.writer(archivo, delimiter=",", quoting=csv.QUOTE_MINIMAL)
            # Escribir cabeceras
            escritor.writerow(headers_csv)
            # Escribir los registros completos
            escritor.writerows(data_rows)
        print(f"\n📊 ¡Procesamiento Completo! Base de datos guardada en CSV con éxito: {output_file}")
    except Exception as e:
        print(f"\n❌ Error guardando el archivo CSV: {e}")

# ------------------------------------------------------------
# EJECUCIÓN DEL CORE SCRIPT
# ------------------------------------------------------------
if __name__ == "__main__":
    CATEGORY = "Category:Anne-Marie_und_Caspar_Reinhart_Collection_at_Museum_Rietberg,_Zürich"
    print("🌍 Extrayendo el índice completo de la colección de los servidores de Wikimedia...")
    files = get_all_files(CATEGORY)
    total_a_procesar = len(files)
    print(f"Total de objetos arqueológicos detectados: {total_a_procesar}")

    all_data = []
    tareas = list(enumerate(files, 1))

    print(f"🚀 Lanzando 10 Workers asíncronos para extraer metadatos de los {total_a_procesar} registros...")
    start_time = time.time()
    
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(procesar_un_archivo, tarea): tarea for tarea in tareas}
        
        for completado, future in enumerate(as_completed(futures), 1):
            resultado = future.result()
            all_data.append(resultado)
            print(f"\rProgreso global: [{completado}/{total_a_procesar}] extraídos y estructurados para CSV...", end="", flush=True)

    end_time = time.time()
    print(f"\n⏱️ Tiempo total de ejecución asíncrona: {end_time - start_time:.2f} segundos.")

    print("Escribiendo el archivo CSV final...")
    save_to_csv(all_data)