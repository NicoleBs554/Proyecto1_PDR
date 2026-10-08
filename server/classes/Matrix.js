/**
 * Clase extra: ejemplo de que el servidor funciona
 * para CUALQUIER clase con CUALQUIER cantidad de parámetros.
 */
class Matrix {
    suma(MA, MB) {
        return MA.map((fila, i) => fila.map((v, j) => v + MB[i][j]));
    }
    inversa(M) {
        // Solo matrices 2x2 para este ejemplo
        if (M.length !== 2 || M[0].length !== 2) {
            throw new Error("inversa(): solo se soporta matriz 2x2");
        }
        const det = M[0][0] * M[1][1] - M[0][1] * M[1][0];
        if (det === 0) throw new Error("Matriz singular (det = 0)");
        return [
            [ M[1][1] / det, -M[0][1] / det],
            [-M[1][0] / det,  M[0][0] / det]
        ];
    }
}

module.exports = Matrix;
