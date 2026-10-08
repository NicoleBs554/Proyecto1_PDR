const assert = require("assert");
const net = require("net");
const RPCClient = require("../client/client");

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 3000);
const classPath = "classes/Operations";

async function testClientCalls() {
    const client = new RPCClient();
    await client.connect(host, port);
    try {
        const calls = await Promise.all([
            client.call(classPath, "Operations", "sumar", [10, 5]),
            client.call(classPath, "Operations", "restar", [10, 5]),
            client.call(classPath, "Operations", "multiplicar", [10, 5]),
            client.call(classPath, "Operations", "dividir", [10, 5]),
            client.call(classPath, "Operations", "dividir", [10, 0])
        ]);

        assert.deepStrictEqual(calls.slice(0, 4).map((result) => result.data.req), [15, 5, 50, 2]);
        assert(calls.slice(0, 4).every((result) => result.sts === true && result.msg === "OK"));
        assert.deepStrictEqual(calls[4], {
            sts: false,
            msg: "Division entre cero no permitida",
            data: { req: null }
        });
    } finally {
        await client.disconnect();
    }
}

function testTcpFraming() {
    const requests = [
        { path: classPath, classname: "Operations", methalname: "sumar", params: [1, 2] },
        { path: classPath, classname: "Operations", methalname: "multiplicar", params: [3, 4] },
        { path: "../index", classname: "index", methalname: "toString", params: [] }
    ];

    return new Promise((resolve, reject) => {
        const socket = net.createConnection({ host, port });
        const responses = [];
        let buffer = "";
        const timeout = setTimeout(() => {
            socket.destroy();
            reject(new Error("Timeout en prueba de encuadre TCP"));
        }, 5000);

        socket.on("connect", () => {
            const payload = Buffer.from(requests.map((request) => JSON.stringify(request) + "\n").join(""));
            socket.write(payload.subarray(0, 9));
            setTimeout(() => socket.write(payload.subarray(9)), 25);
        });

        socket.on("data", (chunk) => {
            buffer += chunk.toString();
            let newline;
            while ((newline = buffer.indexOf("\n")) !== -1) {
                responses.push(JSON.parse(buffer.slice(0, newline)));
                buffer = buffer.slice(newline + 1);
                if (responses.length === requests.length) {
                    clearTimeout(timeout);
                    try {
                        assert.strictEqual(responses[0].data.req, 3);
                        assert.strictEqual(responses[1].data.req, 12);
                        assert.strictEqual(responses[2].sts, false);
                        assert.match(responses[2].msg, /path debe apuntar/);
                        socket.end();
                        resolve();
                    } catch (error) {
                        socket.destroy();
                        reject(error);
                    }
                    return;
                }
            }
        });

        socket.on("error", (error) => {
            clearTimeout(timeout);
            reject(error);
        });
    });
}

(async () => {
    await testClientCalls();
    await testTcpFraming();
    console.log("Integración RPC: OK (operaciones, cola, framing TCP y respuestas de error)");
})().catch((error) => {
    console.error("Integración RPC: FALLÓ");
    console.error(error);
    process.exitCode = 1;
});
