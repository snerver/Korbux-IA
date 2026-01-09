import json
import traceback
from datetime import datetime
from typing import Any, Dict, Optional

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
        self.base_url: str = "local://api"
        self.headers: Dict[str, str] = {
            "Content-Type": "application/json",
            "User-Agent": f"KorbuxClient/{config.metadata.get('version', '0.0.0')}",
            "Accept-Language": config.localization.get("default_language", "es")
        }
        self.timeout: int = config.environment.get("timeout", 5)
        self.simulated_endpoints: Dict[str, Any] = {}

    # Simulación de GET
    def get(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return self._simulate("GET", endpoint, params)

    # Simulación de POST
    def post(self, endpoint: str, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return self._simulate("POST", endpoint, data)

    # Simulación de PUT
    def put(self, endpoint: str, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return self._simulate("PUT", endpoint, data)

    # Simulación de DELETE
    def delete(self, endpoint: str) -> Dict[str, Any]:
        return self._simulate("DELETE", endpoint)

    # Registro semántico de interacción
    def _simulate(self, method: str, endpoint: str, payload: Optional[Any] = None) -> Dict[str, Any]:
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
        try:
            registrar_evento_auditoria(
                tipo="interacción",
                modulo="api_client",
                datos=response,
                nivel="info"
            )
        except Exception as e:
            logger.warning(f"Fallo al registrar auditoría: {e}")

        return response

    # Registro de error simulado
    def simulate_error(self, method: str, endpoint: str, error_message: str = "Error simulado") -> Dict[str, Any]:
        trace = traceback.format_stack()
        logger.error(f"[APIClient] {method} {endpoint} → {error_message}")
        try:
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
        except Exception as e:
            logger.warning(f"Fallo al registrar auditoría de error: {e}")

        return {
            "status": 500,
            "error": error_message,
            "endpoint": endpoint
        }

    # Registro de endpoints simulados
    def register_simulated_endpoint(self, endpoint: str, response: Dict[str, Any]) -> None:
        self.simulated_endpoints[endpoint] = response
        logger.debug(f"Endpoint simulado registrado: {endpoint}")

    # Consulta directa a endpoint registrado
    def query_simulated(self, endpoint: str) -> Dict[str, Any]:
        return self.simulated_endpoints.get(endpoint, {
            "status": 404,
            "message": f"Endpoint {endpoint} no registrado"
        })

    # Exportar configuración actual
    def export_config(self) -> Dict[str, Any]:
        return {
            "base_url": self.base_url,
            "headers": self.headers,
            "timeout": self.timeout,
            "simulated_endpoints": list(self.simulated_endpoints.keys())
        }

    # Preparado para integración con módulos neuronales
    def enviar_a_modelo(self, datos: Dict[str, Any]) -> Dict[str, Any]:
        return self.post("/modelo/predict", datos)


# Instancia global reutilizable
api_client = APIClient()
