# Privacidad

La skill usa la dirección que el usuario configuró en la app Alexa, solo si concede el permiso `alexa::devices:all:address:full:read`.

- No hay base de datos en este MVP.
- La dirección se geocodifica en la misma petición y se descarta.
- Los logs pueden incluir ciudad y código de país, no la calle.
- Nominatim recibe la consulta de geocodificación (política de uso de OSM).
- EMSC y USGS reciben coordenadas y un radio, no el nombre del usuario.

Antes de certificar la skill, publica esta política en una URL HTTPS real y ponla en `skill-package/skill.json`.
