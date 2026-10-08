/**
 * Clase de operaciones aritméticas.
 * El servidor la invoca dinámicamente por nombre.
 */
class Operations {
    sumar(x, y)    { return x + y; }
    restar(x, y)   { return x - y; }
    multiplicar(x, y) { return x * y; }
    dividir(x, y) {
        if (y === 0) {
            // Se lanza un Error: el servidor lo captura y devuelve sts:false
            throw new Error("Division entre cero no permitida");
        }
        return x / y;
    }
}

module.exports = Operations;
