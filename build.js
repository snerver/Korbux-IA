const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const distPath = path.join(__dirname, "dist");

// Función de log con marca de tiempo
function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

// ------------------------------
// Limpiar carpeta dist
// ------------------------------
log("Limpiando carpeta dist...");
if (fs.existsSync(distPath)) {
  fs.rmSync(distPath, { recursive: true, force: true });
}
fs.mkdirSync(distPath, { recursive: true });
log("Carpeta dist lista");

// ------------------------------
// Verificar instalación de TypeScript
// ------------------------------
try {
  execSync("tsc --version", { stdio: "ignore" });
} catch {
  console.error("TypeScript no está instalado. Ejecuta: npm install -g typescript");
  process.exit(1);
}

// ------------------------------
// Compilar TypeScript
// ------------------------------
log("Compilando TypeScript...");
try {
  execSync("tsc --project tsconfig.json", { stdio: "inherit" });
  log("Compilación completada");
} catch (err) {
  console.error("Error al compilar TypeScript:", err.message);
  process.exit(1);
}

// ------------------------------
// Copiar archivos necesarios
// ------------------------------
const filesToCopy = ["korbux.json", "package.json", "README.md"];
filesToCopy.forEach((file) => {
  const src = path.join(__dirname, file);
  if (fs.existsSync(src)) {
    try {
      fs.copyFileSync(src, path.join(distPath, file));
      log(`Archivo ${file} copiado`);
    } catch (err) {
      console.error(`Error al copiar ${file}:`, err.message);
    }
  } else {
    log(`Archivo ${file} no encontrado, se omitió la copia`);
  }
});

// ------------------------------
// Modo producción: optimización
// ------------------------------
if (process.env.NODE_ENV === "production") {
  log("Modo producción: optimizando build...");
  // Aquí podrías integrar herramientas como terser para minificar JS
  // Ejemplo: execSync("npx terser dist/*.js -o dist/*.min.js");
}

log("Build finalizado correctamente");
