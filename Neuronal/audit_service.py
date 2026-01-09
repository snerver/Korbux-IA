# Neuronal/audit_service.py

import json
import os
from datetime import datetime
from threading import Lock

from .config import config
from .logging_config import configurar_logger

logger = configurar_logger(config.environment.get("log_level", "INFO"))

class Auditor:
    """
    Servicio de auditoría evolutiva para KORBUX IA.
    Registra eventos semánticos, errores, decisiones técnicas y trazabilidad cultural.
    """

    def __init__(self, ruta=None):
        self.ruta = ruta or config.audit["log_path"]
        self.eventos = []
        self.max_log_size_mb = config.audit.get("max_log_size_mb", 10)
        self.lock = Lock()  # 1️⃣ Protección concurrente

        # 2️⃣ Crear archivo si no existe
        if not os.path.exists(self.ruta):
            with open(self.ruta, "w", encoding="utf-8") as f:
                json.dump([], f, indent=2, ensure_ascii=False)

    # 3️⃣ Registro semántico completo
    def registrar(self, tipo, modulo, datos, nivel="info"):
        evento = {
            "id": self._generar_id(),
            "timestamp": datetime.utcnow().isoformat(),
            "tipo": tipo,
            "modulo": modulo,
            "nivel": nivel,
            "datos": datos,
            "usuario": config.metadata.get("author", "desconocido"),
            "entorno": config.env,
            "idioma": config.localization.get("default_language", "es"),
            "zona_horaria": config.localization.get("timezone"),
            "version": config.metadata.get("version"),
            "cultura": config.localization.get("culture_profile")
        }

        self.eventos.append(evento)
        logger.debug(f"[Auditoría] {tipo.upper()} registrado en {modulo}")
        self._guardar_evento(evento)

    # 4️⃣ Guardado seguro con bloqueo
    def _guardar_evento(self, evento):
        try:
            with self.lock:
                with open(self.ruta, "r+", encoding="utf-8") as f:
                    historial = json.load(f)
                    historial.append(evento)
                    f.seek(0)
                    json.dump(historial, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error("[Auditoría] Error al guardar evento", exc_info=True)

    # 5️⃣ ID único trazable
    def _generar_id(self):
        return "evt-" + datetime.utcnow().strftime("%Y%m%d%H%M%S%f")

    # 6️⃣ Exportación completa
    def exportar_eventos(self):
        try:
            with open(self.ruta, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []

    # 7️⃣ Exportación filtrada por tipo
    def exportar_por_tipo(self, tipo):
        return [e for e in self.exportar_eventos() if e["tipo"] == tipo]

    # 8️⃣ Exportación filtrada por módulo
    def exportar_por_modulo(self, modulo):
        return [e for e in self.exportar_eventos() if e["modulo"] == modulo]

    # 9️⃣ Exportación por nivel
    def exportar_por_nivel(self, nivel):
        return [e for e in self.exportar_eventos() if e["nivel"] == nivel]

    # 🔟 Limpieza con respaldo inteligente
    def limpiar_historial(self, respaldo=True):
        if respaldo:
            respaldo_path = self.ruta.replace(".json", f"_respaldo_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.json")
            with open(respaldo_path, "w", encoding="utf-8") as f:
                json.dump(self.exportar_eventos(), f, indent=2, ensure_ascii=False)
        with open(self.ruta, "w", encoding="utf-8") as f:
            json.dump([], f, indent=2, ensure_ascii=False)

    # 1️⃣1️⃣ Verificación de tamaño
    def verificar_tamaño(self):
        if os.path.exists(self.ruta):
            tamaño_mb = os.path.getsize(self.ruta) / (1024 * 1024)
            return round(tamaño_mb, 2)
        return 0

    # 1️⃣2️⃣ Detección de sobrecarga
    def esta_saturado(self):
        return self.verificar_tamaño() >= self.max_log_size_mb

    # 1️⃣3️⃣ Registro automático si saturado
    def registrar_si_no_saturado(self, tipo, modulo, datos, nivel="info"):
        if not self.esta_saturado():
            self.registrar(tipo, modulo, datos, nivel)
        else:
            logger.warning("[Auditoría] Registro omitido por saturación")

    # 1️⃣4️⃣ Exportación como CSV (estructura)
    def exportar_csv(self, path="auditoria.csv"):
        import csv
        eventos = self.exportar_eventos()
        campos = ["id", "timestamp", "tipo", "modulo", "nivel", "usuario", "entorno"]
        with open(path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=campos)
            writer.writeheader()
            for e in eventos:
                writer.writerow({k: e.get(k, "") for k in campos})

    # 1️⃣5️⃣ Conteo por tipo
    def contar_por_tipo(self):
        conteo = {}
        for e in self.exportar_eventos():
            conteo[e["tipo"]] = conteo.get(e["tipo"], 0) + 1
        return conteo

    # 1️⃣6️⃣ Conteo por módulo
    def contar_por_modulo(self):
        conteo = {}
        for e in self.exportar_eventos():
            conteo[e["modulo"]] = conteo.get(e["modulo"], 0) + 1
        return conteo

    # 1️⃣7️⃣ Últimos eventos
    def ultimos_eventos(self, n=10):
        return self.exportar_eventos()[-n:]

    # 1️⃣8️⃣ Buscar por palabra clave
    def buscar(self, palabra):
        return [e for e in self.exportar_eventos() if palabra.lower() in json.dumps(e).lower()]

    # 1️⃣9️⃣ Generar resumen evolutivo
    def resumen(self):
        return {
            "total": len(self.exportar_eventos()),
            "por_tipo": self.contar_por_tipo(),
            "por_modulo": self.contar_por_modulo(),
            "tamaño_mb": self.verificar_tamaño()
        }

    # 2️⃣0️⃣ Preparado para visualización modular
    def generar_panel(self):
        return {
            "eventos_recientes": self.ultimos_eventos(5),
            "resumen": self.resumen()
        }

# Instancia global
auditor = Auditor()

# Función pública para registrar eventos
def registrar_evento_auditoria(tipo, modulo, datos, nivel="info"):
    auditor.registrar_si_no_saturado(tipo, modulo, datos, nivel)
