# Neuronal/data_preprocessing.py

import re
import unicodedata
from datetime import datetime
from typing import Dict, List, Union

from .audit_service import registrar_evento_auditoria
from .config import config
from .logging_config import configurar_logger

logger = configurar_logger(config.environment.get("log_level", "INFO"))

class Preprocesador:
    """
    Módulo de preprocesamiento semántico para KORBUX IA.
    Limpia, normaliza, valida y transforma datos para uso neuronal, ético y evolutivo.
    """

    def __init__(self):
        self.idioma = config.localization.get("default_language", "es")
        self.cultura = config.localization.get("culture_profile", "neutral")
        self.stopwords = set(["el", "la", "los", "las", "de", "que", "y", "a", "en", "un", "una"])

    # 1️⃣ Limpieza semántica y cultural
    def limpiar_texto(self, texto: str) -> str:
        if not isinstance(texto, str):
            return ""
        texto = unicodedata.normalize("NFKC", texto.strip())
        texto = re.sub(r"\s+", " ", texto)
        texto = re.sub(r"[^\w\s.,;:¿?¡!@#%&()\-]", "", texto)
        return texto

    # 2️⃣ Normalización a minúsculas
    def normalizar_minusculas(self, texto: str) -> str:
        return texto.lower()

    # 3️⃣ Eliminación de stopwords
    def eliminar_stopwords(self, texto: str, stopwords: Union[List[str], None] = None) -> str:
        sw = set(stopwords) if stopwords else self.stopwords
        return " ".join([p for p in texto.split() if p not in sw])

    # 4️⃣ Tokenización básica
    def tokenizar(self, texto: str) -> List[str]:
        return texto.split()

    # 5️⃣ Validación de tipo de dato
    def validar_dato(self, dato: Union[str, int, float, dict, list]) -> bool:
        return isinstance(dato, (str, int, float, dict, list))

    # 6️⃣ Transformación de fecha
    def transformar_fecha(self, fecha_str: str, formato: str = "%Y-%m-%d") -> Union[datetime, None]:
        try:
            return datetime.strptime(fecha_str, formato)
        except Exception:
            return None

    # 7️⃣ Limpieza de listas
    def limpiar_lista(self, lista: List) -> List[str]:
        return [self.limpiar_texto(str(item)) for item in lista if item]

    # 8️⃣ Preprocesamiento recursivo de diccionarios
    def preprocesar_dict(self, datos: Dict) -> Dict:
        resultado = {}
        for clave, valor in datos.items():
            if isinstance(valor, str):
                resultado[clave] = self.limpiar_texto(valor)
            elif isinstance(valor, list):
                resultado[clave] = self.limpiar_lista(valor)
            elif isinstance(valor, dict):
                resultado[clave] = self.preprocesar_dict(valor)
            else:
                resultado[clave] = valor
        return resultado

    # 9️⃣ Registro evolutivo del preprocesamiento
    def registrar_preprocesamiento(self, origen: str, datos: Union[str, dict]):
        registrar_evento_auditoria(
            tipo="interacción",
            modulo="data_preprocessing",
            datos={"origen": origen, "datos": datos},
            nivel="info"
        )

    # 🔟 Resumen de texto limitado
    def resumen_texto(self, texto: str, max_palabras: int = 50) -> str:
        tokens = self.tokenizar(self.limpiar_texto(texto))
        return " ".join(tokens[:max_palabras])

    # 1️⃣1️⃣ Detección de formato
    def detectar_formato(self, texto: str) -> str:
        if re.match(r"^\d{4}-\d{2}-\d{2}$", texto):
            return "fecha"
        elif re.match(r"^\d+$", texto):
            return "entero"
        elif re.match(r"^\d+\.\d+$", texto):
            return "decimal"
        elif texto.startswith("{") and texto.endswith("}"):
            return "json"
        else:
            return "texto"

    # 1️⃣2️⃣ Preparación para modelo neuronal
    def preparar_para_modelo(self, entrada: Union[str, dict, list]) -> Union[str, dict, list]:
        if isinstance(entrada, str):
            texto = self.limpiar_texto(entrada)
            texto = self.normalizar_minusculas(texto)
            texto = self.eliminar_stopwords(texto)
            return texto
        elif isinstance(entrada, dict):
            return self.preprocesar_dict(entrada)
        elif isinstance(entrada, list):
            return self.limpiar_lista(entrada)
        else:
            return str(entrada)

    # 1️⃣3️⃣ Validación semántica de texto
    def es_texto_valido(self, texto: str) -> bool:
        return bool(texto and isinstance(texto, str) and len(texto.strip()) > 3)

    # 1️⃣4️⃣ Normalización de puntuación
    def normalizar_puntuacion(self, texto: str) -> str:
        return re.sub(r"\s([?.!])", r"\1", texto)

    # 1️⃣5️⃣ Detección de idioma (simulada)
    def detectar_idioma(self, texto: str) -> str:
        if "the" in texto.lower():
            return "en"
        elif "el" in texto.lower():
            return "es"
        return "desconocido"

    # 1️⃣6️⃣ Generación de contexto cultural
    def generar_contexto_cultural(self, texto: str) -> Dict:
        return {
            "idioma_detectado": self.detectar_idioma(texto),
            "cultura": self.cultura,
            "zona_horaria": config.localization.get("timezone")
        }

    # 1️⃣7️⃣ Limpieza profunda
    def limpieza_profunda(self, texto: str) -> str:
        texto = self.limpiar_texto(texto)
        texto = self.normalizar_minusculas(texto)
        texto = self.normalizar_puntuacion(texto)
        return texto

    # 1️⃣8️⃣ Preprocesamiento completo
    def preprocesar_completo(self, entrada: Union[str, dict, list]) -> Union[str, dict, list]:
        resultado = self.preparar_para_modelo(entrada)
        self.registrar_preprocesamiento("preprocesar_completo", resultado)
        return resultado

    # 1️⃣9️⃣ Generar resumen evolutivo
    def resumen_evolutivo(self, entrada: Union[str, dict, list]) -> Dict:
        return {
            "tipo": type(entrada).__name__,
            "formato": self.detectar_formato(str(entrada)),
            "valido": self.validar_dato(entrada),
            "resumen": self.resumen_texto(str(entrada))
        }

    # 2️⃣0️⃣ Preparado para integración con razonador
    def generar_vector_semántico(self, texto: str) -> List[str]:
        tokens = self.tokenizar(self.limpieza_profunda(texto))
        return [t for t in tokens if len(t) > 2]
