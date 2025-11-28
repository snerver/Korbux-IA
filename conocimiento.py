# Neuronal/conocimiento.py

import json
import os
from datetime import datetime
from threading import Lock

from .audit_service import registrar_evento_auditoria
from .config import config
from .logging_config import configurar_logger

logger = configurar_logger(config.environment.get("log_level", "INFO"))

class BaseConocimiento:
    """
    Núcleo de conocimiento evolutivo para KORBUX IA.
    Permite cargar, consultar, actualizar, auditar, filtrar, exportar y visualizar bloques de conocimiento semántico.
    """

    def __init__(self, ruta=None):
        self.ruta = ruta or os.path.join(config.environment["data_dir"], "conocimiento.json")
        self.conocimiento = {}
        self.lock = Lock()  # 1️⃣ Protección concurrente
        self._cargar()

    # 2️⃣ Carga segura con auditoría
    def _cargar(self):
        if os.path.exists(self.ruta):
            try:
                with open(self.ruta, "r", encoding="utf-8") as f:
                    self.conocimiento = json.load(f)
                logger.info("[Conocimiento] Base cargada correctamente.")
            except Exception as e:
                logger.error("[Conocimiento] Error al cargar base", exc_info=True)
                registrar_evento_auditoria("error", "conocimiento", {"error": str(e)}, nivel="sistema")
        else:
            self.conocimiento = {}
            self._guardar()

    # 3️⃣ Guardado seguro con bloqueo
    def _guardar(self):
        try:
            with self.lock:
                with open(self.ruta, "w", encoding="utf-8") as f:
                    json.dump(self.conocimiento, f, indent=2, ensure_ascii=False)
                logger.debug("[Conocimiento] Base guardada.")
        except Exception as e:
            logger.error("[Conocimiento] Error al guardar base", exc_info=True)
            registrar_evento_auditoria("error", "conocimiento", {"error": str(e)}, nivel="sistema")

    # 4️⃣ Agregar entrada con trazabilidad semántica
    def agregar(self, clave, valor, fuente="manual"):
        evento = {
            "valor": valor,
            "fuente": fuente,
            "timestamp": datetime.utcnow().isoformat(),
            "autor": config.metadata.get("author", "desconocido"),
            "version": config.metadata.get("version"),
            "entorno": config.env,
            "idioma": config.localization.get("default_language", "es"),
            "zona_horaria": config.localization.get("timezone"),
            "cultura": config.localization.get("culture_profile")
        }
        self.conocimiento[clave] = evento
        self._guardar()
        registrar_evento_auditoria("evolución", "conocimiento", {"clave": clave, "fuente": fuente}, nivel="info")

    # 5️⃣ Consultar entrada
    def consultar(self, clave):
        return self.conocimiento.get(clave)

    # 6️⃣ Verificar existencia
    def existe(self, clave):
        return clave in self.conocimiento

    # 7️⃣ Eliminar entrada con auditoría
    def eliminar(self, clave):
        if clave in self.conocimiento:
            del self.conocimiento[clave]
            self._guardar()
            registrar_evento_auditoria("sistema", "conocimiento", {"clave": clave, "accion": "eliminado"}, nivel="warning")

    # 8️⃣ Listar claves
    def listar_claves(self):
        return list(self.conocimiento.keys())

    # 9️⃣ Buscar por palabra clave
    def buscar(self, palabra):
        return {
            k: v for k, v in self.conocimiento.items()
            if palabra.lower() in json.dumps(v, ensure_ascii=False).lower()
        }

    # 🔟 Exportar base completa
    def exportar(self):
        return self.conocimiento

    # 1️⃣1️⃣ Exportar por fuente
    def exportar_por_fuente(self, fuente):
        return {k: v for k, v in self.conocimiento.items() if v.get("fuente") == fuente}

    # 1️⃣2️⃣ Exportar por autor
    def exportar_por_autor(self, autor):
        return {k: v for k, v in self.conocimiento.items() if v.get("autor") == autor}

    # 1️⃣3️⃣ Exportar por idioma
    def exportar_por_idioma(self, idioma):
        return {k: v for k, v in self.conocimiento.items() if v.get("idioma") == idioma}

    # 1️⃣4️⃣ Exportar por cultura
    def exportar_por_cultura(self, cultura):
        return {k: v for k, v in self.conocimiento.items() if v.get("cultura") == cultura}

    # 1️⃣5️⃣ Exportar como JSON a archivo externo
    def exportar_a_json(self, path):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.conocimiento, f, indent=2, ensure_ascii=False)

    # 1️⃣6️⃣ Exportar como CSV
    def exportar_a_csv(self, path):
        import csv
        campos = ["clave", "valor", "fuente", "autor", "timestamp"]
        with open(path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(campos)
            for k, v in self.conocimiento.items():
                writer.writerow([k, v["valor"], v["fuente"], v["autor"], v["timestamp"]])

    # 1️⃣7️⃣ Resumen evolutivo
    def resumen(self):
        return {
            "total": len(self.conocimiento),
            "última_actualización": max((v["timestamp"] for v in self.conocimiento.values()), default="N/A"),
            "autores": list(set(v["autor"] for v in self.conocimiento.values())),
            "versiones": list(set(v["version"] for v in self.conocimiento.values())),
            "idiomas": list(set(v["idioma"] for v in self.conocimiento.values())),
            "culturas": list(set(v["cultura"] for v in self.conocimiento.values()))
        }

    # 1️⃣8️⃣ Últimos N registros
    def ultimos(self, n=10):
        return sorted(self.conocimiento.items(), key=lambda x: x[1]["timestamp"], reverse=True)[:n]

    # 1️⃣9️⃣ Filtrar por fecha
    def filtrar_por_fecha(self, desde=None, hasta=None):
        desde = desde or "0000-01-01T00:00:00"
        hasta = hasta or datetime.utcnow().isoformat()
        return {
            k: v for k, v in self.conocimiento.items()
            if desde <= v["timestamp"] <= hasta
        }

    # 2️⃣0️⃣ Generar panel visual
    def generar_panel(self):
        return {
            "resumen": self.resumen(),
            "últimos": self.ultimos(5)
        }

    # 2️⃣1️⃣ Validar estructura de entrada
    def validar_entrada(self, clave, valor):
        return isinstance(clave, str) and isinstance(valor, (str, dict))

    # 2️⃣2️⃣ Agregar solo si no existe
    def agregar_si_nuevo(self, clave, valor, fuente="manual"):
        if not self.existe(clave):
            self.agregar(clave, valor, fuente)

    # 2️⃣3️⃣ Reemplazar entrada existente
    def reemplazar(self, clave, nuevo_valor, fuente="actualización"):
        self.agregar(clave, nuevo_valor, fuente)

    # 2️⃣4️⃣ Contar por fuente
    def contar_por_fuente(self):
        conteo = {}
        for v in self.conocimiento.values():
            fuente = v.get("fuente", "desconocida")
            conteo[fuente] = conteo.get(fuente, 0) + 1
        return conteo

    # 2️⃣5️⃣ Contar por autor
    def contar_por_autor(self):
        conteo = {}
        for v in self.conocimiento.values():
            autor = v.get("autor", "desconocido")
            conteo[autor] = conteo.get(autor, 0) + 1
        return conteo

    # 2️⃣6️⃣ Obtener claves por patrón
    def claves_por_patron(self, patron):
        return [k for k in self.conocimiento if patron.lower() in k.lower()]

    # 2️⃣7️⃣ Obtener entradas por módulo (si clave lo indica)
    def entradas_por_modulo(self, nombre_modulo):
        return {k: v for k, v in self.conocimiento.items() if nombre_modulo.lower() in k.lower()}

    # 2️⃣8️⃣ Generar respaldo automático
    def generar_respaldo(self):
        path = self.ruta.replace(".json", f"_respaldo_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.json")
        self.exportar_a_json(path)

       # 3️⃣0️⃣ Restaurar desde respaldo
    def restaurar_desde_respaldo(self, path):
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    datos = json.load(f)
                    self.conocimiento.update(datos)
                    self._guardar()
                    registrar_evento_auditoria("sistema", "conocimiento", {"accion": "restaurado", "archivo": path}, nivel="info")
            except Exception as e:
                logger.error("[Conocimiento] Error al restaurar respaldo", exc_info=True)

    # 3️⃣1️⃣ Validar duplicados por valor
    def detectar_duplicados(self):
        valores = {}
        duplicados = {}
        for clave, entrada in self.conocimiento.items():
            val = json.dumps(entrada["valor"], ensure_ascii=False)
            if val in valores:
                duplicados.setdefault(val, []).append(clave)
            else:
                valores[val] = clave
        return duplicados

    # 3️⃣2️⃣ Normalizar claves
    def normalizar_claves(self):
        nuevas = {}
        for clave, entrada in self.conocimiento.items():
            clave_normalizada = clave.strip().lower().replace(" ", "_")
            nuevas[clave_normalizada] = entrada
        self.conocimiento = nuevas
        self._guardar()

    # 3️⃣3️⃣ Validar consistencia semántica
    def validar_consistencia(self):
        inconsistencias = []
        for clave, entrada in self.conocimiento.items():
            if "valor" not in entrada or "timestamp" not in entrada:
                inconsistencias.append(clave)
        return inconsistencias

    # 3️⃣4️⃣ Generar índice por fecha
    def indexar_por_fecha(self):
        index = {}
        for clave, entrada in self.conocimiento.items():
            fecha = entrada["timestamp"].split("T")[0]
            index.setdefault(fecha, []).append(clave)
        return index

    # 3️⃣5️⃣ Generar índice por módulo (si clave lo indica)
    def indexar_por_modulo(self):
        index = {}
        for clave in self.conocimiento:
            partes = clave.split(".")
            if len(partes) > 1:
                modulo = partes[0]
                index.setdefault(modulo, []).append(clave)
        return index

    # 3️⃣6️⃣ Preparar para razonamiento
    def generar_contexto_para_razonador(self):
        return {
            clave: entrada["valor"]
            for clave, entrada in self.conocimiento.items()
            if isinstance(entrada["valor"], (str, dict))
        }

    # 3️⃣7️⃣ Generar resumen por fuente
    def resumen_por_fuente(self):
        resumen = {}
        for clave, entrada in self.conocimiento.items():
            fuente = entrada.get("fuente", "desconocida")
            resumen.setdefault(fuente, []).append(clave)
        return resumen

    # 3️⃣8️⃣ Generar resumen por idioma
    def resumen_por_idioma(self):
        resumen = {}
        for clave, entrada in self.conocimiento.items():
            idioma = entrada.get("idioma", "es")
            resumen.setdefault(idioma, []).append(clave)
        return resumen

    # 3️⃣9️⃣ Generar resumen por cultura
    def resumen_por_cultura(self):
        resumen = {}
        for clave, entrada in self.conocimiento.items():
            cultura = entrada.get("cultura", "neutral")
            resumen.setdefault(cultura, []).append(clave)
        return resumen

    # 4️⃣0️⃣ Generar vista simplificada
    def vista_simplificada(self):
        return {
            clave: entrada["valor"]
            for clave, entrada in self.conocimiento.items()
        }

    # 4️⃣1️⃣ Generar vista enriquecida
    def vista_enriquecida(self):
        return {
            clave: {
                "valor": entrada["valor"],
                "autor": entrada["autor"],
                "timestamp": entrada["timestamp"]
            }
            for clave, entrada in self.conocimiento.items()
        }

    # 4️⃣2️⃣ Generar vista por módulo
    def vista_por_modulo(self, modulo):
        return {
            clave: entrada
            for clave, entrada in self.conocimiento.items()
            if clave.startswith(modulo + ".")
        }

    # 4️⃣3️⃣ Generar vista por patrón
    def vista_por_patron(self, patron):
        return {
            clave: entrada
            for clave, entrada in self.conocimiento.items()
            if patron.lower() in clave.lower()
        }

    # 4️⃣4️⃣ Generar vista por autor
    def vista_por_autor(self, autor):
        return {
            clave: entrada
            for clave, entrada in self.conocimiento.items()
            if entrada.get("autor") == autor
        }

    # 4️⃣5️⃣ Generar vista por fuente
    def vista_por_fuente(self, fuente):
        return {
            clave: entrada
            for clave, entrada in self.conocimiento.items()
            if entrada.get("fuente") == fuente
        }

    # 4️⃣6️⃣ Generar vista por idioma
    def vista_por_idioma(self, idioma):
        return {
            clave: entrada
            for clave, entrada in self.conocimiento.items()
            if entrada.get("idioma") == idioma
        }

    # 4️⃣7️⃣ Generar vista por cultura
    def vista_por_cultura(self, cultura):
        return {
            clave: entrada
            for clave, entrada in self.conocimiento.items()
            if entrada.get("cultura") == cultura
        }

    # 4️⃣8️⃣ Generar vista por fecha
    def vista_por_fecha(self, fecha):
        return {
            clave: entrada
            for clave, entrada in self.conocimiento.items()
            if entrada["timestamp"].startswith(fecha)
        }

    # 4️⃣9️⃣ Generar vista por versión
    def vista_por_version(self, version):
        return {
            clave: entrada
            for clave, entrada in self.conocimiento.items()
            if entrada.get("version") == version
        }

    # 5️⃣0️⃣ Preparado para sincronización modular
    def generar_paquete_sincronizable(self):
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "autor": config.metadata.get("author"),
            "version": config.metadata.get("version"),
            "contenido": self.vista_simplificada()
        }

# Instancia global
base_conocimiento = BaseConocimiento()
