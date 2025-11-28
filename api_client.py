# Neuronal/api_client.py

import json
import traceback
from datetime import datetime

from .audit_service import registrar_evento_auditoria
from .config import config
from .logging_config import configurar_logger

logger = configurar_logger(config.environment.get("log_level", "INFO"))

class APIClient:
    """
    Cliente simulado para entornos sin acceso a internet.
    Permite registrar interacciones, simular respuestas y mantener trazabilidad evolutiva.
    """

    def __init__(self):
        self.base_url = "local://api"
        self.headers = {
            "Content-Type": "application/json",
            "User-Agent": f"KorbuxClient/{config.metadata.get('version')}",
            "Accept-Language": config.localization.get("default_language", "es")
        }
        self.timeout = 5
        self.simulated_endpoints = {}

    # 1️⃣ Simulación de GET
    def get(self, endpoint, params=None):
        return self._simulate("GET", endpoint, params)

    # 2️⃣ Simulación de POST
    def post(self, endpoint, data=None):
        return self._simulate("POST", endpoint, data)

    # 3️⃣ Simulación de PUT
    def put(self, endpoint, data=None):
        return self._simulate("PUT", endpoint, data)

    # 4️⃣ Simulación de DELETE
    def delete(self, endpoint):
        return self._simulate("DELETE", endpoint)

    # 5️⃣ Registro semántico de interacción
    def _simulate(self, method, endpoint, payload=None):
        timestamp = datetime.utcnow().isoformat()
        response = {
            "status": 200,
            "method": method,
            "endpoint": endpoint,
            "payload": payload,
            "timestamp": timestamp,
            "message": f"Simulación local de {method} en {endpoint}"
        }

        logger.info(f"[APIClient] {method} {endpoint} → Simulado")
        registrar_evento_auditoria(
            tipo="interacción",
            modulo="api_client",
            datos=response,
            nivel="info"
        )

        return response

    # 6️⃣ Registro de error simulado
    def simulate_error(self, method, endpoint, error_message="Error simulado"):
        trace = traceback.format_stack()
        logger.error(f"[APIClient] {method} {endpoint} → {error_message}")
        registrar_evento_auditoria(
            tipo="error",
            modulo="api_client",
            datos={
                "metodo": method,
                "endpoint": endpoint,
                "error": error_message,
                "trace": trace
            },
            nivel="sistema"
        )
        return {
            "status": 500,
            "error": error_message,
            "endpoint": endpoint
        }

    # 7️⃣ Registro de endpoints simulados
    def register_simulated_endpoint(self, endpoint, response):
        self.simulated_endpoints[endpoint] = response

    # 8️⃣ Consulta directa a endpoint registrado
    def query_simulated(self, endpoint):
        return self.simulated_endpoints.get(endpoint, {
            "status": 404,
            "message": f"Endpoint {endpoint} no registrado"
        })

    # 9️⃣ Exportar configuración actual
    def export_config(self):
        return {
            "base_url": self.base_url,
            "headers": self.headers,
            "timeout": self.timeout,
            "simulated_endpoints": list(self.simulated_endpoints.keys())
        }

    # 🔟 Preparado para integración con módulos neuronales
    def enviar_a_modelo(self, datos):
        return self.post("/modelo/predict", datos)

# 1️⃣1️⃣ Instancia global reutilizable
api_client = APIClient()
