# Proyecto1_PDR

Servidor y cliente RPC sobre TCP (módulo `net` de Node.js) con una interfaz web para invocar
operaciones aritméticas y suma de matrices.

## Requisitos

- Node.js 18 o superior (incluye npm)

## Instalación

```bash
npm install
```

## Uso

| Comando          | Qué hace                                                        |
|------------------|-----------------------------------------------------------------|
| `npm start`      | Levanta el servidor RPC (puerto 3000) y la interfaz web (3001) |
| `npm run server` | Solo el servidor RPC TCP                                        |
| `npm run web`    | Solo la interfaz web (http://127.0.0.1:3001)                    |
| `npm run client` | Cliente de consola de ejemplo (requiere el servidor activo)     |
| `npm test`       | Levanta todo, ejecuta las pruebas de integración y lo apaga     |

Después de `npm start`, abre http://127.0.0.1:3001 y conéctate a `127.0.0.1:3000`.

### Variables de entorno

- `HOST` / `PORT`: dirección del servidor RPC (por defecto `127.0.0.1:3000`)
- `WEB_HOST` / `WEB_PORT`: dirección de la interfaz web (por defecto `127.0.0.1:3001`)
