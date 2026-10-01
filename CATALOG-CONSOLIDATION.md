# Consolidación del catálogo

La aplicación carga los cuatro archivos `lugares*.json` y pasa el resultado por
`js/catalog.js`. La consolidación es determinista: primero elimina IDs
repetidos y luego fusiona registros con el mismo nombre normalizado cuando sus
coordenadas están a 8 km o menos. En empates se conserva el primer registro;
el registro con más campos aporta la información faltante.

La validación automatizada falla ante:

- IDs repetidos.
- El mismo nombre normalizado para dos lugares geográficamente coincidentes.
- Coordenadas repetidas (o prácticamente iguales, a menos de 1 m) con IDs
  distintos. Esto evita confundir atracciones cercanas que comparten una zona
  turística con registros copiados.

Los homónimos geográficos legítimos se conservan. Por ejemplo, `Cañón de los
Perdidos` (IDs 70 y 82) y `Reserva Nacional Pacaya Samiria` (IDs 64 y 95)
permanecen separados porque sus coordenadas están ampliamente distantes.

## Resultado actual

- Registros antes de consolidar: **202**.
- Registros consolidados: **193**.
- Registros duplicados eliminados: **9**.
- `Laguna 69`: las tres entradas (IDs 54, 91 y 144) se trataron como el mismo
  atractivo. Se conserva el ID **54**, con el nombre canónico `Laguna 69`; las
  entradas 91 y 144 se eliminaron.
