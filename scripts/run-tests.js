/**
 * Levanta el servidor RPC y la interfaz web, ejecuta las pruebas
 * de integración y apaga ambos procesos al terminar.
 */
const { spawn } = require("child_process");
const net = require("net");
const path = require("path");

const root = path.resolve(__dirname, "..");
const node = process.execPath;

function waitForPort(port, host = "127.0.0.1", timeoutMs = 5000) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
        const tryConnect = () => {
            const socket = net.createConnection({ port, host }, () => {
                socket.end();
                resolve();
            });
            socket.on("error", () => {
                socket.destroy();
                if (Date.now() - start > timeoutMs) reject(new Error(`Puerto ${port} no disponible`));
                else setTimeout(tryConnect, 100);
            });
        };
        tryConnect();
    });
}

function run(file) {
    return new Promise((resolve) => {
        spawn(node, [file], { cwd: root, stdio: "inherit" }).on("exit", (code) => resolve(code ?? 1));
    });
}

(async () => {
    const children = [
        spawn(node, ["server/index.js"], { cwd: root, stdio: "ignore" }),
        spawn(node, ["client/web-server.js"], { cwd: root, stdio: "ignore" })
    ];
    let exitCode = 1;
    try {
        await waitForPort(Number(process.env.PORT || 3000));
        await waitForPort(Number(process.env.WEB_PORT || 3001));
        exitCode = (await run("test/integration.js")) || (await run("test/web-integration.js"));
    } catch (error) {
        console.error(error.message);
    } finally {
        children.forEach((child) => child.kill());
    }
    process.exitCode = exitCode;
})();
