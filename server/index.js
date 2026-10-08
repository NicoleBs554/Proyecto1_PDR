/**
 * SERVIDOR RPC — Node.js, librería 'net' (TCP)
 * Registrado con ip: y port:
 *
 * Solicitud que espera (JSON delimitado por salto de línea):
 *   { protocol: "TCP",
 *     path:       "classes/Operations",
 *     classname:  "Operations",
 *     methalname: "sumar",
 *     params:     [2, 3] }
 *
 * Respuesta:
 *   Éxito -> { sts: true,  msg: "OK", data: { req: <resultado> } }
 *   Error -> { sts: false, msg: "...", data: { req: null } }
 */
const net = require("net");
const path = require("path");

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 3000);
const CLASSES_DIR = path.resolve(__dirname, "classes");
const MAX_MESSAGE_SIZE = 1024 * 1024;

// ------------------- Núcleo RPC -------------------
function procesarSolicitud(raw) {
    let solicitud;
    try {
        solicitud = JSON.parse(raw.toString());
    } catch (e) {
        return respuesta(false, "JSON inválido: " + e.message, null);
    }

    const { path: p, classname, methalname, params } = solicitud;

    try {
        if (!p || !classname || !methalname) {
            throw new Error("Faltan campos: path / classname / methalname");
        }
        if (!Array.isArray(params)) {
            throw new Error("params debe ser un array");
        }

        // Solo se permiten clases dentro de server/classes.
        const classPath = path.resolve(__dirname, p);
        const relativePath = path.relative(CLASSES_DIR, classPath);
        if (relativePath === ".." || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
            throw new Error("path debe apuntar a una clase dentro de classes/");
        }

        const Clase = require(classPath);
        if (typeof Clase !== "function") {
            throw new Error(`"${p}" no exporta una clase`);
        }
        if (Clase.name !== classname) {
            throw new Error(`classname "${classname}" != clase exportada "${Clase.name}"`);
        }

        // Instancia y llamada dinámica con cualquier cantidad de parámetros
        const instancia = new Clase();
        const method = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(instancia), methalname);
        if (!method || typeof method.value !== "function") {
            throw new Error(`El método "${methalname}" no existe en ${classname}`);
        }
        const resultado = method.value.apply(instancia, params);

        return respuesta(true, "OK", resultado);
    } catch (e) {
        return respuesta(false, e.message, null);
    }
}

function respuesta(sts, msg, req) {
    return JSON.stringify({ sts, msg, data: { req } });
}

// ------------------- Servidor TCP -------------------
const server = net.createServer((socket) => {
    console.log(`[+] Cliente conectado: ${socket.remoteAddress}:${socket.remotePort}`);

    socket.on("data", (data) => {
        socket.buffer = Buffer.concat([socket.buffer || Buffer.alloc(0), data]);

        if (socket.buffer.length > MAX_MESSAGE_SIZE && !socket.buffer.includes(10)) {
            socket.write(respuesta(false, "Solicitud demasiado grande", null) + "\n", () => socket.destroy());
            return;
        }

        let newline;
        while ((newline = socket.buffer.indexOf(10)) !== -1) {
            const solicitud = socket.buffer.subarray(0, newline);
            socket.buffer = socket.buffer.subarray(newline + 1);
            if (solicitud.length > MAX_MESSAGE_SIZE) {
                socket.write(respuesta(false, "Solicitud demasiado grande", null) + "\n", () => socket.destroy());
                return;
            }
            console.log(`[<-] Solicitud: ${solicitud.toString()}`);
            socket.write(procesarSolicitud(solicitud) + "\n");
        }
        if (socket.buffer.length > MAX_MESSAGE_SIZE) {
            socket.write(respuesta(false, "Solicitud demasiado grande", null) + "\n", () => socket.destroy());
        }
    });

    socket.on("error", (err) => {
        console.log(`[!] Error con cliente: ${err.message}`);
    });
    socket.on("close", () => {
        console.log(`[-] Cliente desconectado: ${socket.remoteAddress}:${socket.remotePort}`);
    });
});

server.listen(PORT, HOST, () => {
    console.log(`Servidor RPC escuchando en ${HOST}:${PORT} (TCP)`);
});
