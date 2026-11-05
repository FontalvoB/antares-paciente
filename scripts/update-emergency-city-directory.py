#!/usr/bin/env python3
"""Descarga límites oficiales sin renovar la verificación de teléfonos ni sus fechas."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import copy
import json
import math
from pathlib import Path
import re
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

CATALOG = Path(__file__).resolve().parents[1] / 'src/data/emergency-city-directory.json'


def read(url):
    with urlopen(Request(url, headers={'User-Agent': 'CoppAdresdEmergencyDirectory/1.0'}), timeout=30) as response:
        data = json.load(response)
    if data.get('error'):
        raise ValueError(f'La fuente rechazó la consulta: {data["error"]}')
    return data


def inside(point, ring):
    x, y = point
    result = False
    for i in range(len(ring)):
        a, b = ring[i - 1], ring[i]
        if (a[1] > y) != (b[1] > y) and x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]:
            result = not result
    return result


def esri_geometry(data):
    rings = data['features'][0]['geometry']['rings']
    wkid = data.get('spatialReference', {}).get('latestWkid', data.get('spatialReference', {}).get('wkid'))
    if wkid not in (3857, 102100, 4326):
        raise ValueError(f'Proyección no admitida: {wkid}')
    converted = []
    for ring in rings:
        points = [[round(math.degrees(x / 6378137), 6), round(math.degrees(math.atan(math.sinh(y / 6378137))), 6)]
                  if wkid in (3857, 102100) else [round(x, 6), round(y, 6)] for x, y in ring]
        if len(points) < 4 or points[0] != points[-1]:
            raise ValueError('La fuente contiene un anillo incompleto')
        converted.append(points)
    # Esri: exteriores en sentido horario; huecos en sentido antihorario.
    def area(ring):
        return sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(ring, ring[1:]))
    polygons = [[ring] for ring in converted if area(ring) < 0]
    for hole in [ring for ring in converted if area(ring) >= 0]:
        owners = [polygon for polygon in polygons if inside(hole[0], polygon[0])]
        if len(owners) != 1:
            raise ValueError('No se pudo asignar un hueco a una única jurisdicción')
        owners[0].append(hole)
    if not polygons:
        raise ValueError('La fuente no contiene polígonos exteriores')
    return {'type': 'Polygon', 'coordinates': polygons[0]} if len(polygons) == 1 else {'type': 'MultiPolygon', 'coordinates': polygons}


def refresh(city):
    country, code = city['id'].split('-', 1)
    source = city['boundary']['sourceUrl'].rstrip('/')
    host = urlparse(source).hostname
    if country == 'CO' and re.fullmatch(r'\d{5}', code) and host == 'geoportal.dane.gov.co':
        data = read(source + '/query?' + urlencode({'f': 'pjson', 'where': f"MPIO_CDPMP='{code}'", 'outFields': '*', 'returnGeometry': 'true'}))
        features = data.get('features', [])
        if len(features) != 1 or features[0]['attributes']['MPIO_CDPMP'] != code:
            raise ValueError(f'La fuente no identifica un municipio único: {city["id"]}')
        return esri_geometry(data)
    if country == 'US' and re.fullmatch(r'\d{7}', code) and host == 'tigerweb.geo.census.gov':
        data = read(source + '/query?' + urlencode({'f': 'geojson', 'where': f"GEOID='{code}'", 'outFields': 'GEOID,NAME', 'returnGeometry': 'true', 'outSR': 4326, 'maxAllowableOffset': 0.0001, 'geometryPrecision': 6}))
        features = data.get('features', [])
        if len(features) != 1 or features[0]['properties']['GEOID'] != code or not features[0].get('geometry'):
            raise ValueError(f'La fuente no identifica una ciudad única: {city["id"]}')
        return features[0]['geometry']
    raise ValueError(f'Identificador o fuente no admitidos: {city["id"]}')


def format_catalog(data):
    data = copy.deepcopy(data)
    geometries = []
    for i, city in enumerate(data['cities']):
        geometry = city['boundary']['geometry']
        marker = f'__EMERGENCY_GEOMETRY_{i}__'
        geometries.append((marker, geometry))
        city['boundary']['geometry'] = marker
    text = json.dumps(data, ensure_ascii=False, indent=2)
    for marker, geometry in geometries:
        text = text.replace(json.dumps(marker), json.dumps(geometry, separators=(',', ':')))
    return text + '\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path, help='Archivo para revisar; no sobrescribe el catálogo de entrada')
    args = parser.parse_args()
    if args.output.resolve() == CATALOG.resolve():
        parser.error('Genera primero un archivo temporal y revisa el diff antes de reemplazar el catálogo')
    data = json.loads(CATALOG.read_text())
    if data['version'] != 1:
        raise ValueError('Versión no admitida')
    with ThreadPoolExecutor(max_workers=2) as executor:
        geometries = list(executor.map(refresh, data['cities']))
    for city, geometry in zip(data['cities'], geometries):
        city['boundary']['geometry'] = geometry
    # Escribe solo después de completar todas las consultas.
    args.output.write_text(format_catalog(data))
    print(f'Límites descargados en {args.output}. Las fechas y la verificación de teléfonos no fueron renovadas; requieren revisión humana.')


if __name__ == '__main__':
    main()
