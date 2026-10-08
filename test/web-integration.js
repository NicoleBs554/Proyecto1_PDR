const assert = require("assert");

const baseUrl = process.env.WEB_URL || "http://127.0.0.1:3001";

async function post(path, payload) {
    return fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
}

(async () => {
    const page = await fetch(baseUrl);
    assert.strictEqual(page.status, 200);
    const html = await page.text();
    assert.match(html, /Calcula en/);
    assert.match(html, /Suma de matrices/);

    const resetConnection = await post("/api/disconnect", {});
    assert.strictEqual(resetConnection.status, 200);

    const disconnectedCall = await post("/api/call", { operation: "sumar", x: 1, y: 2 });
    assert.strictEqual(disconnectedCall.status, 409);

    const invalidConnect = await post("/api/connect", { ip: "not-an-ip", port: 3000 });
    assert.strictEqual(invalidConnect.status, 400);

    const connect = await post("/api/connect", { ip: "127.0.0.1", port: 3000 });
    assert.strictEqual(connect.status, 200);
    assert.strictEqual((await connect.json()).connected, true);

    const cases = [
        ["sumar", 15],
        ["restar", 5],
        ["multiplicar", 50],
        ["dividir", 2]
    ];
    for (const [operation, expected] of cases) {
        const response = await post("/api/call", { operation, x: 10, y: 5 });
        assert.strictEqual(response.status, 200);
        const result = await response.json();
        assert.strictEqual(result.sts, true);
        assert.strictEqual(result.data.req, expected);
    }

    const divisionByZero = await post("/api/call", { operation: "dividir", x: 10, y: 0 });
    assert.strictEqual((await divisionByZero.json()).sts, false);

    const matrixSum = await post("/api/matrix-call", {
        matrixA: [[1, 2], [3, 4]],
        matrixB: [[5, 6], [7, 8]]
    });
    assert.strictEqual(matrixSum.status, 200);
    const matrixResult = await matrixSum.json();
    assert.strictEqual(matrixResult.sts, true);
    assert.deepStrictEqual(matrixResult.data.req, [[6, 8], [10, 12]]);

    const invalidMatrix = await post("/api/matrix-call", {
        matrixA: [[1, 2], [3, 4]],
        matrixB: [[5, 6, 7], [8, 9, 10]]
    });
    assert.strictEqual(invalidMatrix.status, 400);

    const disconnect = await post("/api/disconnect", {});
    assert.strictEqual(disconnect.status, 200);
    assert.strictEqual((await disconnect.json()).connected, false);

    console.log("Integración UI HTTP + RPC TCP: OK");
})().catch((error) => {
    console.error("Integración UI HTTP + RPC TCP: FALLÓ");
    console.error(error);
    process.exitCode = 1;
});
