# Neuronal/feedback_loop.py
import json
import os
from datetime import datetime
from threading import Lock

from .audit_service import registrar_evento_auditoria
from .config import config
from .conocimiento import base_conocimiento
from .logging_config import configurar_logger

logger = configurar_logger(config.environment.get("log_level", "INFO"))

class FeedbackLoop:
    """
    Módulo de retroalimentación evolutiva para KORBUX IA.
    Captura, valida, registra y transforma feedback humano o sistémico en conocimiento trazable.
    """

    def __init__(self, ruta=None):
        self.ruta = ruta or os.path.join(config.environment["data_dir"], "feedback.json")
        self.feedback = []
        self.lock = Lock()  # 1️⃣ Protección concurrente
        self.max_size_mb = 5  # 2️⃣ Límite de tamaño
        self._cargar()

    # 3️⃣ Carga segura con auditoría
    def _cargar(self):
        if os.path.exists(self.ruta):
            try:
                with open(self.ruta, "r", encoding="utf-8") as f:
                    self.feedback = json.load(f)
                logger.info("[FeedbackLoop] Retroalimentación cargada.")
            except Exception as e:
                logger.error("[FeedbackLoop] Error al cargar feedback", exc_info=True)
                registrar_evento_auditoria("error", "feedback_loop", {"error": str(e)}, nivel="sistema")
        else:
            self.feedback = []
            self._guardar()

    # 4️⃣ Guardado seguro con bloqueo
    def _guardar(self):
        try:
            with self.lock:
                with open(self.ruta, "w", encoding="utf-8") as f:
                    json.dump(self.feedback, f, indent=2, ensure_ascii=False)
                logger.debug("[FeedbackLoop] Feedback guardado.")
        except Exception as e:
            logger.error("[FeedbackLoop] Error al guardar feedback", exc_info=True)

    # 5️⃣ Registro semántico completo
    def registrar_feedback(self, tipo, origen, contenido, autor=None, impacto="neutro"):
        entrada = {
            "id": self._generar_id(),
            "timestamp": datetime.utcnow().isoformat(),
            "tipo": tipo,
            "origen": origen,
            "contenido": contenido,
            "autor": autor or config.metadata.get("author", "desconocido"),
            "impacto": impacto,
            "entorno": config.env,
            "idioma": config.localization.get("default_language", "es"),
            "cultura": config.localization.get("culture_profile"),
            "version": config.metadata.get("version")
        }
        self.feedback.append(entrada)
        self._guardar()
        registrar_evento_auditoria("evolución", "feedback_loop", {"tipo": tipo, "origen": origen}, nivel="info")

    # 6️⃣ Generador de ID único
    def _generar_id(self):
        return "fbk-" + datetime.utcnow().strftime("%Y%m%d%H%M%S%f")

    # 7️⃣ Exportación completa
    def exportar(self):
        return self.feedback

    # 8️⃣ Filtrado por tipo
    def filtrar_por_tipo(self, tipo):
        return [f for f in self.feedback if f["tipo"] == tipo]

    # 9️⃣ Filtrado por origen
    def filtrar_por_origen(self, origen):
        return [f for f in self.feedback if f["origen"] == origen]

    # 🔟 Filtrado por impacto
    def filtrar_por_impacto(self, impacto):
        return [f for f in self.feedback if f["impacto"] == impacto]

    # 1️⃣1️⃣ Aplicar como conocimiento
    def aplicar_como_conocimiento(self):
        for f in self.feedback:
            clave = f"{f['origen']}.{f['id']}"
            base_conocimiento.agregar(clave, f["contenido"], fuente="feedback")

    # 1️⃣2️⃣ Resumen evolutivo
    def resumen(self):
        return {
            "total": len(self.feedback),
            "por_tipo": self._contar("tipo"),
            "por_origen": self._contar("origen"),
            "por_impacto": self._contar("impacto")
        }

    # 1️⃣3️⃣ Conteo por campo
    def _contar(self, campo):
        conteo = {}
        for f in self.feedback:
            valor = f.get(campo, "desconocido")
            conteo[valor] = conteo.get(valor, 0) + 1
        return conteo

    # 1️⃣4️⃣ Últimos N registros
    def ultimos(self, n=10):
        return self.feedback[-n:]

    # 1️⃣5️⃣ Generar panel visual
    def generar_panel(self):
        return {
            "resumen": self.resumen(),
            "últimos": self.ultimos(5)
        }

    # 1️⃣6️⃣ Buscar por palabra clave
    def buscar(self, palabra):
        return [f for f in self.feedback if palabra.lower() in json.dumps(f, ensure_ascii=False).lower()]

    # 1️⃣7️⃣ Exportar por autor
    def exportar_por_autor(self, autor):
        return [f for f in self.feedback if f.get("autor") == autor]

    # 1️⃣8️⃣ Exportar por idioma
    def exportar_por_idioma(self, idioma):
        return [f for f in self.feedback if f.get("idioma") == idioma]

    # 1️⃣9️⃣ Verificar tamaño del archivo
    def verificar_tamaño(self):
        if os.path.exists(self.ruta):
            return round(os.path.getsize(self.ruta) / (1024 * 1024), 2)
        return 0

    # 2️⃣0️⃣ Generar respaldo automático
    def generar_respaldo(self):
        path = self.ruta.replace(".json", f"_respaldo_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.feedback, f, indent=2, ensure_ascii=False)
        registrar_evento_auditoria("sistema", "feedback_loop", {"accion": "respaldo", "archivo": path}, nivel="info")

# Instancia global
feedback_loop = FeedbackLoop()
