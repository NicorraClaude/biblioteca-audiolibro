// Cuántas sesiones paralelas lanza Audio masivo, y su lista para el matrix.
//
// Vive acá y no en el YAML a propósito: cambiar el YAML obliga a Nico a subirlo a
// mano por la web (el token no tiene el scope `workflow`), mientras que este archivo
// se pushea normal. Para subir o bajar la paralelización, se cambia el número de acá.
//
// Techo real: GitHub corre hasta 20 jobs simultáneos en repos públicos del plan
// gratuito. Pedir más no rompe nada, pero los de más quedan esperando turno y no
// aceleran: cada job tiene su propio reloj y el que espera arranca tarde.
const SESIONES = Number(process.env.SHARDS ?? 20);

console.log(`shards=${JSON.stringify([...Array(SESIONES).keys()])}`);
console.log(`total=${SESIONES}`);
