const fs = require("fs");
const http = require("http");
const net = require("net");
const path = require("path");
const RPCClient = require("./client");

const WEB_HOST = process.env.WEB_HOST || "127.0.0.1";
const WEB_PORT = Number(process.env.WEB_PORT || 3001);
const PUBLIC_DIR = path.join(__dirname, "public");
const MAX_BODY_SIZE = 16 * 1024;
const OPERATIONS = new Set(["sumar", "restar", "multiplicar", "dividir"]);
const MAX_MATRIX_SIZE = 8;

let rpcClient = null;
let connection = null;

function sendJson(response, statusCode, payload) {
    response.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
    });
    response.end(JSON.stringify(payload));
}

function readJson(request) {
    return new Promise((resolve, reject) => {
        let body = "";
        request.setEncoding("utf8");
        request.on("data", (chunk) => {
            body += chunk;
            if (Buffer.byteLength(body) > MAX_BODY_SIZE) {
                reject(new Error("La solicitud excede el tamaño permitido"));
                request.destroy();
            }
        });
        request.on("end", () => {
            try {
                resolve(JSON.parse(body));
            } catch (error) {
                reject(new Error("El cuerpo debe ser JSON válido"));
            }
        });
        request.on("error", reject);
    });
}

async function handleApi(request, response) {
    if (request.method === "GET" && request.url === "/api/status") {
        sendJson(response, 200, { connected: Boolean(connection), connection });
        return;
    }

    if (request.method !== "POST") {
        sendJson(response, 405, { error: "Método HTTP no permitido" });
        return;
    }

    let payload;
    try {
        payload = await readJson(request);
    } catch (error) {
        sendJson(response, 400, { error: error.message });
        return;
    }

    if (request.url === "/api/connect") {
        const { ip, port } = payload;
        if (typeof ip !== "string" || net.isIP(ip) === 0 || !Number.isInteger(port) || port < 1 || port > 65535) {
            sendJson(response, 400, { error: "Indica una dirección IP válida y un puerto entre 1 y 65535" });
            return;
        }
        if (connection) {
            sendJson(response, 409, { error: "Ya existe una conexión. Desconéctala antes de cambiar el destino." });
            return;
        }

        const client = new RPCClient();
        try {
            await client.connect(ip, port);
            rpcClient = client;
            connection = { ip, port, protocol: "TCP" };
            sendJson(response, 200, { connected: true, connection });
        } catch (error) {
            await client.disconnect();
            sendJson(response, 502, { error: `No se pudo conectar con ${ip}:${port}: ${error.message}` });
        }
        return;
    }

    if (request.url === "/api/disconnect") {
        if (rpcClient) await rpcClient.disconnect();
        rpcClient = null;
        connection = null;
        sendJson(response, 200, { connected: false });
        return;
    }

    if (request.url === "/api/call") {
        const { operation, x, y } = payload;
        if (!OPERATIONS.has(operation) || !Number.isFinite(x) || !Number.isFinite(y)) {
            sendJson(response, 400, { error: "Selecciona una operación válida e ingresa dos números finitos" });
            return;
        }
        if (!rpcClient || !connection) {
            sendJson(response, 409, { error: "Conecta primero con el servidor RPC" });
            return;
        }

        try {
            const result = await rpcClient.call("classes/Operations", "Operations", operation, [x, y]);
            sendJson(response, 200, result);
        } catch (error) {
            sendJson(response, 502, { sts: false, msg: error.message, data: { req: null } });
        }
        return;
    }

    if (request.url === "/api/matrix-call") {
        const { matrixA, matrixB } = payload;
        const validMatrix = (matrix) =>
            Array.isArray(matrix) &&
            matrix.length > 0 &&
            matrix.length <= MAX_MATRIX_SIZE &&
            matrix.every((row) =>
                Array.isArray(row) &&
                row.length === matrix.length &&
                row.every((value) => Number.isFinite(value))
            );

        if (!validMatrix(matrixA) || !validMatrix(matrixB) || matrixA.length !== matrixB.length) {
            sendJson(response, 400, {
                error: `Ingresa dos matrices cuadradas del mismo tamaño (máximo ${MAX_MATRIX_SIZE}×${MAX_MATRIX_SIZE})`
            });
            return;
        }
        if (!rpcClient || !connection) {
            sendJson(response, 409, { error: "Conecta primero con el servidor RPC" });
            return;
        }

        try {
            const result = await rpcClient.call("classes/Matrix", "Matrix", "suma", [matrixA, matrixB]);
            sendJson(response, 200, result);
        } catch (error) {
            sendJson(response, 502, { sts: false, msg: error.message, data: { req: null } });
        }
        return;
    }

    sendJson(response, 404, { error: "Endpoint no encontrado" });
}

const contentTypes = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8"
};

const server = http.createServer((request, response) => {
    if (request.url && request.url.startsWith("/api/")) {
        handleApi(request, response).catch((error) => {
            if (!response.headersSent) sendJson(response, 500, { error: error.message });
            else response.destroy(error);
        });
        return;
    }

    const pathname = request.url === "/" ? "/index.html" : request.url;
    const filePath = path.resolve(PUBLIC_DIR, `.${decodeURIComponent(pathname.split("?")[0])}`);
    if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            response.writeHead(error.code === "ENOENT" ? 404 : 500);
            response.end(error.code === "ENOENT" ? "Not found" : "Internal server error");
            return;
        }
        response.writeHead(200, {
            "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
            "Cache-Control": "no-store"
        });
        response.end(content);
    });
});

server.listen(WEB_PORT, WEB_HOST, () => {
    console.log(`Interfaz RPC disponible en http://${WEB_HOST}:${WEB_PORT}`);
});

server.on("close", () => {
    if (rpcClient) rpcClient.disconnect();
});

process.on("SIGINT", () => {
    server.close(() => process.exit(0));
});

process.on("SIGTERM", () => {
    server.close(() => process.exit(0));
});
