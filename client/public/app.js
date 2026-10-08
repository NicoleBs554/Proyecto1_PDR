const connectionForm = document.querySelector("#connection-form");
const ipInput = document.querySelector("#ip");
const portInput = document.querySelector("#port");
const connectButton = document.querySelector("#connect-button");
const disconnectButton = document.querySelector("#disconnect-button");
const connectionState = document.querySelector("#connection-state");
const stateLabel = document.querySelector("#state-label");
const connectionMessage = document.querySelector("#connection-message");
const operationForm = document.querySelector("#operation-form");
const xInput = document.querySelector("#operand-x");
const yInput = document.querySelector("#operand-y");
const calculateButton = document.querySelector("#calculate-button");
const runAllButton = document.querySelector("#run-all-button");
const operationMessage = document.querySelector("#operation-message");
const matrixButton = document.querySelector("#matrix-calculate-button");
const matrixMessage = document.querySelector("#matrix-message");
const matrixResult = document.querySelector("#matrix-result");
const formula = document.querySelector("#formula");
const resultEmpty = document.querySelector("#result-empty");
const resultContent = document.querySelector("#result-content");
const resultCaption = document.querySelector("#result-caption");
const resultValue = document.querySelector("#result-value");
const resultStatus = document.querySelector("#result-status");
const resultJson = document.querySelector("#result-json");
const historyBody = document.querySelector("#history-body");

const operations = [
  { name: "sumar", symbol: "+", label: "Suma" },
  { name: "restar", symbol: "−", label: "Resta" },
  { name: "multiplicar", symbol: "×", label: "Multiplicación" },
  { name: "dividir", symbol: "÷", label: "División" }
];
let selectedOperation = operations[0];
let connected = false;
let busy = false;

function formatNumber(value) {
  return new Intl.NumberFormat("es", { maximumFractionDigits: 8 }).format(value);
}

function setMessage(element, message = "", kind = "") {
  element.textContent = message;
  element.className = `inline-message${kind ? ` ${kind}` : ""}`;
}

function setConnected(status, target) {
  connected = status;
  connectionState.classList.toggle("connected", status);
  stateLabel.textContent = status ? `CONECTADO · ${target.ip}:${target.port}` : "DESCONECTADO";
  ipInput.disabled = status;
  portInput.disabled = status;
  connectButton.disabled = status || busy;
  disconnectButton.disabled = !status || busy;
  calculateButton.disabled = !status || busy;
  runAllButton.disabled = !status || busy;
  matrixButton.disabled = !status || busy;
}

function updateFormula() {
  const x = Number(xInput.value);
  const y = Number(yInput.value);
  formula.innerHTML = `${Number.isFinite(x) ? formatNumber(x) : "x"} <b>${selectedOperation.symbol}</b> ${Number.isFinite(y) ? formatNumber(y) : "y"} <span>=</span> ?`;
}

function renderResult(operation, x, y, response) {
  const expression = `${formatNumber(x)} ${operation.symbol} ${formatNumber(y)}`;
  const succeeded = response.sts === true;
  resultEmpty.hidden = true;
  resultContent.hidden = false;
  resultCaption.textContent = succeeded ? "RESULTADO" : "OPERACIÓN NO COMPLETADA";
  resultValue.hidden = false;
  matrixResult.hidden = true;
  matrixResult.replaceChildren();
  resultValue.textContent = succeeded ? formatNumber(response.data.req) : "—";
  resultStatus.textContent = succeeded ? "●  sts: true · respuesta recibida" : `●  sts: false · ${response.msg}`;
  resultStatus.classList.toggle("error", !succeeded);
  resultJson.textContent = JSON.stringify(response, null, 2);
  addHistory(operation, expression, succeeded ? formatNumber(response.data.req) : "—", succeeded);
}

function renderMatrixResult(matrixA, matrixB, response) {
  const succeeded = response.sts === true;
  const result = succeeded ? response.data.req : null;
  resultEmpty.hidden = true;
  resultContent.hidden = false;
  resultCaption.textContent = succeeded ? "RESULTADO · MATRIZ C" : "OPERACIÓN NO COMPLETADA";
  resultValue.hidden = true;
  matrixResult.hidden = !succeeded;
  matrixResult.replaceChildren();
  if (succeeded) {
    const table = document.createElement("table");
    table.className = "matrix-result-grid";
    result.forEach((row) => {
      const tableRow = document.createElement("tr");
      row.forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = formatNumber(value);
        tableRow.append(cell);
      });
      table.append(tableRow);
    });
    matrixResult.append(table);
  } else {
    resultValue.hidden = false;
    resultValue.textContent = "—";
  }
  resultStatus.textContent = succeeded ? "●  sts: true · respuesta recibida" : `●  sts: false · ${response.msg}`;
  resultStatus.classList.toggle("error", !succeeded);
  resultJson.textContent = JSON.stringify(response, null, 2);
  const size = matrixA.length;
  const expression = `A + B (${size}×${size})`;
  const historyResult = succeeded
    ? result.map((row) => `[${row.map(formatNumber).join(", ")}]`).join(" ")
    : "—";
  addHistory({ label: "Suma de matrices" }, expression, historyResult, succeeded);
}

function addHistory(operation, expression, value, succeeded) {
  const empty = historyBody.querySelector(".history-empty");
  if (empty) empty.remove();
  const row = document.createElement("tr");
  const cells = [
    operation.label,
    expression,
    value,
    succeeded ? "sts: true" : "sts: false"
  ];
  cells.forEach((text, index) => {
    const cell = document.createElement("td");
    cell.textContent = text;
    if (index === 3) cell.className = succeeded ? "status-ok" : "status-error";
    row.append(cell);
  });
  historyBody.prepend(row);
  while (historyBody.children.length > 12) historyBody.lastElementChild.remove();
}

async function api(path, payload) {
  const response = await fetch(path, {
    method: payload ? "POST" : "GET",
    headers: payload ? { "Content-Type": "application/json" } : {},
    body: payload ? JSON.stringify(payload) : undefined
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || result.msg || `Error HTTP ${response.status}`);
  return result;
}

async function connect() {
  connectButton.disabled = true;
  setMessage(connectionMessage, "Conectando con el servidor…");
  try {
    const target = await api("/api/connect", {
      ip: ipInput.value.trim(),
      port: Number(portInput.value)
    });
    setConnected(true, target.connection);
    setMessage(connectionMessage, "Conexión TCP establecida.", "success");
  } catch (error) {
    setConnected(false);
    setMessage(connectionMessage, error.message, "error");
  }
}

async function disconnect() {
  disconnectButton.disabled = true;
  try {
    await api("/api/disconnect", {});
    setConnected(false);
    setMessage(connectionMessage, "Desconectado del servidor.");
  } catch (error) {
    setMessage(connectionMessage, error.message, "error");
  }
}

async function execute(operation) {
  const x = Number(xInput.value);
  const y = Number(yInput.value);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error("Ingresa dos números válidos.");
  }
  const response = await api("/api/call", { operation: operation.name, x, y });
  renderResult(operation, x, y, response);
  return response;
}

function readMatrix(name, size) {
  const inputs = [...document.querySelectorAll(`[data-matrix="${name}"]`)];
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, column) => {
      const input = inputs.find((item) => Number(item.dataset.row) === row && Number(item.dataset.column) === column);
      return Number(input.value);
    })
  );
}

async function executeMatrix() {
  const inputs = [...document.querySelectorAll("[data-matrix]")];
  const size = Math.sqrt(inputs.length / 2);
  if (!Number.isInteger(size) || inputs.some((input) => input.value.trim() === "" || !Number.isFinite(Number(input.value)))) {
    throw new Error("Ingresa números válidos en todos los elementos de ambas matrices.");
  }
  const matrixA = readMatrix("a", size);
  const matrixB = readMatrix("b", size);
  const response = await api("/api/matrix-call", { matrixA, matrixB });
  renderMatrixResult(matrixA, matrixB, response);
  return response;
}

connectionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  connect();
});

disconnectButton.addEventListener("click", disconnect);

document.querySelectorAll(".operator-button").forEach((button) => {
  button.addEventListener("click", () => {
    selectedOperation = operations.find((operation) => operation.name === button.dataset.operation);
    document.querySelectorAll(".operator-button").forEach((item) => {
      const selected = item === button;
      item.classList.toggle("selected", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    updateFormula();
  });
});

xInput.addEventListener("input", updateFormula);
yInput.addEventListener("input", updateFormula);

operationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!connected || busy) return;
  busy = true;
  setConnected(true, { ip: ipInput.value, port: portInput.value });
  setMessage(operationMessage, "Enviando solicitud RPC…");
  try {
    const result = await execute(selectedOperation);
    setMessage(operationMessage, result.sts ? "Respuesta recibida correctamente." : "El servidor devolvió un error controlado.", result.sts ? "success" : "error");
  } catch (error) {
    setMessage(operationMessage, error.message, "error");
  } finally {
    busy = false;
    setConnected(connected, { ip: ipInput.value, port: portInput.value });
  }
});

runAllButton.addEventListener("click", async () => {
  if (!connected || busy) return;
  busy = true;
  calculateButton.disabled = true;
  runAllButton.disabled = true;
  setMessage(operationMessage, "Ejecutando las cuatro operaciones…");
  try {
    for (const operation of operations) {
      const response = await execute(operation);
      selectedOperation = operation;
      document.querySelectorAll(".operator-button").forEach((button) => {
        const selected = button.dataset.operation === operation.name;
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
      if (!response.sts) throw new Error(`${operation.label}: ${response.msg}`);
    }
    updateFormula();
    setMessage(operationMessage, "Las cuatro operaciones terminaron correctamente.", "success");
  } catch (error) {
    setMessage(operationMessage, error.message, "error");
  } finally {
    busy = false;
    setConnected(connected, { ip: ipInput.value, port: portInput.value });
  }
});

matrixButton.addEventListener("click", async () => {
  if (!connected || busy) return;
  busy = true;
  setConnected(true, { ip: ipInput.value, port: portInput.value });
  setMessage(matrixMessage, "Enviando suma de matrices al servidor…");
  try {
    const response = await executeMatrix();
    setMessage(
      matrixMessage,
      response.sts ? "Suma de matrices completada correctamente." : `El servidor devolvió un error: ${response.msg}`,
      response.sts ? "success" : "error"
    );
  } catch (error) {
    setMessage(matrixMessage, error.message, "error");
  } finally {
    busy = false;
    setConnected(connected, { ip: ipInput.value, port: portInput.value });
  }
});

document.querySelector("#clear-history").addEventListener("click", () => {
  historyBody.innerHTML = '<tr class="history-empty"><td colspan="4">Todavía no hay operaciones.</td></tr>';
});

async function restoreStatus() {
  try {
    const status = await api("/api/status");
    if (status.connected) {
      ipInput.value = status.connection.ip;
      portInput.value = status.connection.port;
      setConnected(true, status.connection);
      setMessage(connectionMessage, "Conexión TCP activa.", "success");
    }
  } catch (error) {
    setMessage(connectionMessage, `No se pudo consultar el estado: ${error.message}`, "error");
  }
}

updateFormula();
restoreStatus();
