// Cuántas sesiones paralelas lanza Audio masivo, y su lista para el matrix.
//
// Vive acá y no en el YAML a propósito: cambiar el YAML obliga a Nico a subirlo a
// mano por la web (el token no tiene el scope `workflow`), mientras que este archivo
// se pushea normal. Para subir o bajar la paralelización, se cambia el número de acá.
//
// Techo real: GitHub corre hasta 20 jobs simultáneos en repos públicos del plan
// gratuito. Pedir más no rompe nada, pero los de más quedan esperando turno y no
// aceleran: cada job tiene su propio reloj y el que espera arranca tarde.
//
// Por qué 15 y no 20: con 20 no queda ni un turno libre y los demás workflows hacen
// cola detrás. Se vio en los tiempos: corridas de "Pedidos de títulos" que tardan un
// minuto de trabajo aparecían con 187, 242 y 279 minutos, y dos se cancelaron por
// esperar demasiado. Eso es un pedido de un usuario real esperando horas. Dejando 5
// turnos libres, los motores pierden un 25% de velocidad y el resto del sistema
// sigue respondiendo.
const SESIONES = Number(process.env.SHARDS ?? 15);

console.log(`shards=${JSON.stringify([...Array(SESIONES).keys()])}`);
console.log(`total=${SESIONES}`);
