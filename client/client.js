/**
 * CLIENTE RPC — Node.js, librería 'net' (TCP)
 * Maneja connect / disconnect con ip: y port:
 * y envía {protocol, path, classname, methalname, params}
 */
const net = require("net");

class RPCClient {
    constructor(protocol = "TCP") {
        this.protocol = protocol;
        this.ip = null;
        this.port = null;
        this.socket = null;
        this.receiveBuffer = Buffer.alloc(0);
        this.callQueue = [];
        this.activeCall = null;
    }

    /** CONNECT — abre la conexión TCP con el servidor */
    connect(ip, port) {
        return new Promise((resolve, reject) => {
            if (this.socket && !this.socket.destroyed) {
                reject(new Error("El cliente ya está conectado"));
                return;
            }

            this.ip = ip;
            this.port = port;
            this.socket = new net.Socket();

            const timeout = setTimeout(() => {
                this.socket.destroy();
                reject(new Error(`Timeout conectando a ${ip}:${port}`));
            }, 5000);

            const onError = (err) => {
                clearTimeout(timeout);
                reject(err);
            };
            this.socket.once("error", onError);
            this.socket.connect(port, ip, () => {
                clearTimeout(timeout);
                this.socket.removeListener("error", onError);
                this.socket.on("data", (data) => this.handleData(data));
                this.socket.on("error", (err) => this.failCalls(err));
                this.socket.on("close", () => this.failCalls(new Error("Conexión cerrada por el servidor")));
                console.log(`Conectado a ${ip}:${port} (${this.protocol})`);
                resolve(true);
            });
        });
    }

    /** Envía una solicitud RPC y devuelve la promesa del resultado */
    call(path, classname, methalname, params = []) {
        return new Promise((resolve, reject) => {
            if (!this.socket || this.socket.destroyed) {
                return reject(new Error("Cliente no conectado. Use connect(ip, port)"));
            }
            if (!Array.isArray(params)) {
                return reject(new Error("params debe ser un array"));
            }

            const solicitud = JSON.stringify({
                protocol: this.protocol,
                path,
                classname,
                methalname,
                params
            });

            this.callQueue.push({ solicitud, resolve, reject });
            this.dispatchCall();
        });
    }

    handleData(data) {
        this.receiveBuffer = Buffer.concat([this.receiveBuffer, data]);
        let newline;
        while ((newline = this.receiveBuffer.indexOf(10)) !== -1) {
            const response = this.receiveBuffer.subarray(0, newline);
            this.receiveBuffer = this.receiveBuffer.subarray(newline + 1);
            if (!this.activeCall) {
                this.failCalls(new Error("Respuesta recibida sin una solicitud pendiente"));
                this.socket.destroy();
                return;
            }
            clearTimeout(this.activeCall.timeout);
            try {
                this.activeCall.resolve(JSON.parse(response.toString()));
            } catch (err) {
                this.activeCall.reject(new Error(`Respuesta inválida: ${response.toString()}`));
            }
            this.activeCall = null;
            this.dispatchCall();
        }
    }

    dispatchCall() {
        if (this.activeCall || this.callQueue.length === 0 || !this.socket || this.socket.destroyed) {
            return;
        }
        this.activeCall = this.callQueue.shift();
        this.activeCall.timeout = setTimeout(() => {
            const call = this.activeCall;
            this.activeCall = null;
            call.reject(new Error("Timeout esperando respuesta del servidor"));
            this.socket.destroy();
        }, 5000);
        this.socket.write(this.activeCall.solicitud + "\n", (err) => {
            if (err) this.failCalls(err);
        });
    }

    failCalls(err) {
        if (this.activeCall) {
            clearTimeout(this.activeCall.timeout);
            this.activeCall.reject(err);
            this.activeCall = null;
        }
        while (this.callQueue.length) {
            this.callQueue.shift().reject(err);
        }
    }

    /** DISCONNECT — cierra la conexión */
    disconnect() {
        return new Promise((resolve) => {
            if (this.socket && !this.socket.destroyed) {
                this.socket.end(() => {
                    console.log("Desconectado del servidor");
                    resolve(true);
                });
            } else {
                resolve(true);
            }
        });
    }
}

module.exports = RPCClient;

if (require.main === module) {
    (async () => {
        const cliente = new RPCClient();
        try {
            await cliente.connect(process.env.HOST || "127.0.0.1", Number(process.env.PORT || 3000));
            const casos = [
                ["sumar", [10, 5]],
                ["restar", [10, 5]],
                ["multiplicar", [10, 5]],
                ["dividir", [10, 5]],
                ["dividir", [10, 0]],
                ["potencia", [2, 3]]
            ];
            for (const [metodo, params] of casos) {
                console.log(`${metodo}(${params.join(", ")}):`, await cliente.call("classes/Operations", "Operations", metodo, params));
            }
        } catch (err) {
            console.error("Error:", err.message);
            process.exitCode = 1;
        } finally {
            await cliente.disconnect();
        }
    })();
}
