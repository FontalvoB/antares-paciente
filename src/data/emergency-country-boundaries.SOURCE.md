# País de las acciones de emergencia

`emergency-country-boundaries.json` deriva de Natural Earth Admin 0 Countries,
escala 1:10 millones, revisión
`ca96624a56bd078437bca8184e78163e5039ad19`.

- [Fuente exacta](https://raw.githubusercontent.com/nvkelso/natural-earth-vector/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_countries.geojson).
- [Dominio público y condiciones de uso](https://www.naturalearthdata.com/about/terms-of-use/).
- Regeneración: `python3 scripts/update-emergency-boundaries.py`.

Se conservan los polígonos de Colombia y de los estados/territorios de Estados
Unidos, incluidos Alaska, Hawái, Puerto Rico, Islas Vírgenes, Guam, Marianas,
Samoa y las islas menores que figuran bajo soberanía estadounidense en la
fuente. Los segmentos compartidos con otros países se guardan aparte para
detectar incertidumbre en fronteras internacionales.

La resolución ocurre completamente en el dispositivo: las coordenadas nunca
se envían a un geocodificador externo. La cartografía es generalizada y no
determina jurisdicción de despacho. Se admite un margen de costa de 500 m
para no descartar barrios costeros por la simplificación; cerca de fronteras
internacionales se exige confirmación cuando la distancia es menor de 1 km
o de la incertidumbre reportada por GPS. Una precisión peor de 50 km tampoco
se presenta como detección confirmada. La selección manual sigue disponible.

Las tres acciones piden servicios distintos al mismo centro unificado:
**123 en Colombia** y **911 en Estados Unidos**. No se infiere el país por
idioma, perfil o zona horaria del teléfono.

- [Policía Nacional: 123 conecta policía, bomberos y servicios médicos](https://www.policia.gov.co/sites/default/files/2024-10/Recomendaciones%20COP%2016.pdf).
- [National 911 Program](https://www.911.gov/calling-911/frequently-asked-questions/).
