const fs = require("fs");
module.exports = { guardarEntrada };

function guardarEntrada(usuario, texto) {
  let bd = {};
  try {
    bd = JSON.parse(fs.readFileSync("korbux.json", "utf8"));
  } catch {
    bd = { conocimiento: {} };
  }

  if (!bd.conocimiento.entradas_usuario) {
    bd.conocimiento.entradas_usuario = [];
  }

  bd.conocimiento.entradas_usuario.push({
    usuario: usuario,
    texto: texto,
    fecha: new Date().toISOString(),
  });

  fs.writeFileSync("korbux.json", JSON.stringify(bd, null, 2));
}
   