/**
 * santaolalla_training.ts — Módulo de entrenamiento para el agente Santa Olalla
 * Orientado a ciencia, física, biología, química y neurociencia.
 *
 * Incluye 20 mejoras necesarias y funcionales:
 * 1) Validación de entradas
 * 2) Limitación de longitud
 * 3) Sanitización de texto
 * 4) Gestión de errores con try/catch
 * 5) Respaldo automático ante corrupción
 * 6) Escritura atómica
 * 7) Rotación por tamaño/mes
 * 8) Compresión opcional (.gz)
 * 9) Exportación (CSV/Markdown)
 * 10) Importación de datos
 * 11) Clasificación automática de disciplina
 * 12) Nivel adaptativo según complejidad
 * 13) Respuestas enriquecidas con plantillas por disciplina
 * 14) Etiquetas temáticas (tags)
 * 15) Listado filtrado y búsqueda
 * 16) Medición extendida (memoria/tamaño)
 * 17) Cache en memoria de eventos recientes
 * 18) Logs detallados locales
 * 19) Variación de respuestas con semilla reproducible
 * 20) API interna de búsqueda avanzada
 */

import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";

type Nivel = "básico" | "intermedio" | "avanzado";

interface EventoCientifico {
  id: string;
  usuario: string;
  consulta: string;
  timestamp: string;
  disciplina: string;
  nivel: Nivel;
  respuesta: string;
  tags: string[];
  meta: {
    duracion_ms: number;
    motor: string;
    version: string;
    memoria_mb?: number;
    db_bytes?: number;
    archivo?: string;
    semilla?: number;
    truncado?: boolean;
    comprimido?: boolean;
  };
}

interface EntrenarOpts {
  usuario: string;
  consulta: string;
  disciplina?: string; // opcional: se auto-detecta si falta
  nivel?: Nivel;       // opcional: se adapta
  tags?: string[];
}

export class SantaOlallaTraining {
  private dbPath: string;
  private logPath: string;
  private gzipEnabled: boolean;
  private maxBytes: number;
  private cache: EventoCientifico[] = []; // cache reciente en memoria
  private cacheMax: number = 100; // tamaño máximo de la cache

  constructor(options?: {
    dbFile?: string;
    logFile?: string;
    gzipEnabled?: boolean; // compresión opcional
    maxBytes?: number;     // umbral de rotación (por tamaño)
  }) {
    const dbFile = options?.dbFile ?? "santaolalla.json";
    this.dbPath = path.resolve(__dirname, dbFile);
    this.logPath = path.resolve(__dirname, options?.logFile ?? "logs/santaolalla.log");
    this.gzipEnabled = options?.gzipEnabled ?? false;
    this.maxBytes = options?.maxBytes ?? 5 * 1024 * 1024; // 5MB

    this.ensureDir(path.dirname(this.dbPath));
    this.ensureDir(path.dirname(this.logPath));

    // Inicializar almacenamiento
    if (!fs.existsSync(this.dbPath)) {
      fs.writeFileSync(this.dbPath, "[]", "utf-8");
    }
    // Inicializar log
    if (!fs.existsSync(this.logPath)) {
      fs.writeFileSync(this.logPath, "", "utf-8");
    }
  }

  // Utilidades

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private generarId(prefix: string = "santaolalla"): string {
    return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  }

  private ahoraISO(): string {
    return new Date().toISOString();
  }

  private medir<T>(fn: () => T): { resultado: T; duracion: number } {
    const inicio = performance.now();
    const resultado = fn();
    const fin = performance.now();
    return { resultado, duracion: fin - inicio };
  }

  private safeRead(file: string): string {
    try {
      return fs.readFileSync(file, "utf-8");
    } catch {
      return "[]";
    }
  }

  private isJsonValid(text: string): boolean {
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed);
    } catch {
      return false;
    }
  }

  private backupCorruptFile(file: string, content: string): void {
    try {
      const bak = `${file}.bak_${Date.now()}`;
      fs.writeFileSync(bak, content, "utf-8");
    } catch (e) {
      // si el backup falla, solo logueamos
      this.writeLog(`Backup failed: ${String(e)}`);
    }
  }

  private writeLog(line: string): void {
    const ts = this.ahoraISO();
    try {
      fs.appendFileSync(this.logPath, `[${ts}] ${line}\n`, "utf-8");
    } catch {
      // best-effort logging
    }
  }

  private writeAtomicJson(pathFile: string, data: unknown): void {
    const tmp = `${pathFile}.tmp`;
    const json = JSON.stringify(data, null, 2);
    fs.writeFileSync(tmp, json, "utf-8");
    fs.renameSync(tmp, pathFile);
  }

  private limitarTexto(t: string, max: number = 10000): { texto: string; truncado: boolean } {
    const s = t.trim();
    if (s.length > max) {
      return { texto: s.slice(0, max), truncado: true };
    }
    return { texto: s, truncado: false };
  }

  private sanitizar(t: string): string {
    // Remueve caracteres no imprimibles y normaliza espacios
    return t.replace(/[^\P{C}\n\t ]+/gu, "").replace(/\s+/g, " ").trim();
  }

  private countComplexity(t: string): number {
    // Métrica simple de complejidad: longitud + cantidad de términos científicos
    const terms = ["teoría", "modelo", "hipótesis", "experimental", "derivación", "ecuación", "molecular", "cuántico", "estadístico"];
    const base = t.length;
    const extra = terms.reduce((acc, term) => acc + (t.toLowerCase().includes(term) ? 10 : 0), 0);
    return base + extra;
  }

  private nivelAdaptativo(t: string): Nivel {
    const c = this.countComplexity(t);
    if (c < 150) return "básico";
    if (c < 600) return "intermedio";
    return "avanzado";
  }

  private detectarDisciplina(t: string): string {
    const s = t.toLowerCase();
    const map: Record<string, string> = {
      física: "física",
      fisica: "física",
      biología: "biología",
      biologia: "biología",
      química: "química",
      quimica: "química",
      neurociencia: "neurociencia",
      genética: "genética",
      quántica: "física",
      cuántica: "física",
      estadística: "estadística",
      estadistica: "estadística",
    };
    for (const k of Object.keys(map)) {
      if (s.includes(k)) return map[k];
    }
    // heurística adicional
    if (/atom|molecule|molecular|protein|enzima|química|reaction|reacción/i.test(s)) return "química";
    if (/cell|célula|neuron|neuro|biología|gen/i.test(s)) return "biología";
    if (/force|campo|quantum|cuántico|física|derivación|ecuación|modelo/i.test(s)) return "física";
    return "ciencia";
  }

  private plantillaRespuesta(consulta: string, disciplina: string, nivel: Nivel): string {
    const c = consulta.trim();
    const d = disciplina.toLowerCase();
    const templates: Record<string, Record<Nivel, string[]>> = {
      física: {
        "básico": [
          `Introducción a "${c}" en física: definición, conceptos clave y ejemplos cotidianos.`,
          `Resumen básico de "${c}" en física con foco en leyes fundamentales.`,
        ],
        "intermedio": [
          `Análisis de "${c}" considerando principios físicos y ecuaciones relevantes.`,
          `Exploración intermedia de "${c}": modelos, supuestos y validaciones.`,
        ],
        "avanzado": [
          `Discusión avanzada de "${c}" integrando teoría, formalismo matemático y límites experimentales.`,
          `Evaluación crítica de "${c}" en física moderna, con referencias a literatura técnica.`,
        ],
      },
      química: {
        "básico": [
          `Explicación de "${c}" en química: entidades, reacciones y ejemplos.`,
          `Introducción básica de "${c}" con enfoque en estructura y función.`,
        ],
        "intermedio": [
          `Análisis intermedio de "${c}" con cinética y termodinámica de reacción.`,
          `Discusión de "${c}" considerando mecanismos y rutas alternativas.`,
        ],
        "avanzado": [
          `Revisión avanzada de "${c}": espectroscopía, química computacional y correlaciones.`,
          `Síntesis crítica de "${c}" con datos y modelos recientes.`,
        ],
      },
      biología: {
        "básico": [
          `Descripción de "${c}" en biología: estructura, función y ejemplos del organismo.`,
          `Panorama básico de "${c}" con enfoque en niveles de organización.`,
        ],
        "intermedio": [
          `Análisis intermedio de "${c}" considerando fisiología y biología celular.`,
          `Discusión de "${c}" con fuentes y estudios claves.`,
        ],
        "avanzado": [
          `Revisión avanzada de "${c}" integrando biología molecular y sistemas.`,
          `Síntesis de "${c}" con énfasis en investigación actual y técnicas.`,
        ],
      },
      neurociencia: {
        "básico": [
          `Explicación de "${c}" en neurociencia: unidades funcionales y ejemplos.`,
          `Panorama básico de "${c}" con circuitos y procesos cognitivos.`,
        ],
        "intermedio": [
          `Análisis de "${c}" con neurofisiología y métodos experimentales.`,
          `Discusión intermedia de "${c}" considerando plasticidad y redes.`,
        ],
        "avanzado": [
          `Revisión avanzada de "${c}" integrando neuroimagen, modelos y hallazgos.`,
          `Síntesis de "${c}" con enfoque en evidencia y teoría de sistemas.`,
        ],
      },
      ciencia: {
        "básico": [
          `Introducción general a "${c}" en ciencia: lenguaje, método y ejemplos.`,
          `Resumen básico de "${c}" en el marco del método científico.`,
        ],
        "intermedio": [
          `Análisis intermedio de "${c}" con principios, modelos y validación.`,
          `Discusión de "${c}" considerando replicabilidad y sesgos.`,
        ],
        "avanzado": [
          `Revisión avanzada de "${c}" integrando teoría, datos y controversias.`,
          `Síntesis crítica de "${c}" con marcos comparativos.`,
        ],
      },
    };

    const set = templates[d] ?? templates["ciencia"];
    const opciones = set[nivel];
    const seed = this.semilla(c + d + nivel);
    const idx = seed % opciones.length;
    return opciones[idx];
  }

  private semilla(s: string): number {
    // Semilla reproducible tipo CRC32 simple
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (h << 5) - h + s.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }

  // Persistencia

  private cargarMemoria(): EventoCientifico[] {
    const content = this.safeRead(this.dbPath);
    if (!this.isJsonValid(content)) {
      this.writeLog("Archivo principal JSON inválido, creando respaldo.");
      this.backupCorruptFile(this.dbPath, content);
      return [];
    }
    try {
      return JSON.parse(content) as EventoCientifico[];
    } catch {
      return [];
    }
  }

  private guardarMemoria(memoria: EventoCientifico[]): void {
    // Rotación por tamaño
    if (fs.existsSync(this.dbPath) && fs.statSync(this.dbPath).size > this.maxBytes) {
      const rotated = path.join(path.dirname(this.dbPath), `santaolalla-${this.anoMes()}.json`);
      try {
        fs.copyFileSync(this.dbPath, rotated);
        this.writeLog(`Rotación de archivo: ${rotated}`);
      } catch (e) {
        this.writeLog(`Error de rotación: ${String(e)}`);
      }
      // Continuar con base limpia en archivo principal
      this.writeAtomicJson(this.dbPath, []);
    }

    // Escritura atómica
    this.writeAtomicJson(this.dbPath, memoria);

    // Compresión opcional
    if (this.gzipEnabled) {
      try {
        const raw = fs.readFileSync(this.dbPath);
        const gz = zlib.gzipSync(raw);
        fs.writeFileSync(`${this.dbPath}.gz`, gz);
      } catch (e) {
        this.writeLog(`Compresión fallida: ${String(e)}`);
      }
    }
  }

  private anoMes(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = `${d.getMonth() + 1}`.padStart(2, "0");
    return `${y}-${m}`;
  }

  // API principal

  entrenar(opts: EntrenarOpts): EventoCientifico {
    // 1) Validación de entradas
    const usuario = this.sanitizar((opts.usuario ?? "").trim());
    const consultaRaw = (opts.consulta ?? "").trim();
    const disciplinaEntrada = (opts.disciplina ?? "").trim();
    const tags = Array.isArray(opts.tags) ? opts.tags.slice(0, 12) : [];

    if (!usuario) throw new Error("Usuario requerido.");
    if (!consultaRaw) throw new Error("Consulta requerida.");

    // 2) Limitación de longitud
    const { texto: consultaLimitada, truncado } = this.limitarTexto(consultaRaw, 10000);

    // 3) Sanitización
    const consulta = this.sanitizar(consultaLimitada);

    // 11) Clasificación automática si falta disciplina
    const disciplina =
      disciplinaEntrada ? this.sanitizar(disciplinaEntrada) : this.detectarDisciplina(consulta);

    // 12) Nivel adaptativo si falta
    const nivel: Nivel = (opts.nivel ?? this.nivelAdaptativo(consulta));

    // 13/19) Respuesta enriquecida con variación reproducible
    const medirResp = this.medir(() => this.generarRespuesta(consulta, disciplina, nivel));
    const respuesta = medirResp.resultado;

    // Evento
    const evento: EventoCientifico = {
      id: this.generarId(),
      usuario,
      consulta,
      timestamp: this.ahoraISO(),
      disciplina,
      nivel,
      respuesta,
      tags,
      meta: {
        duracion_ms: Math.round(medirResp.duracion),
        motor: "SantaOlallaTraining",
        version: "1.0.0",
        memoria_mb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
        db_bytes: fs.existsSync(this.dbPath) ? fs.statSync(this.dbPath).size : 0,
        archivo: path.basename(this.dbPath),
        semilla: this.semilla(consulta + disciplina + nivel),
        truncado,
        comprimido: this.gzipEnabled,
      },
    };

    // Persistencia
    const memoria = this.cargarMemoria();
    memoria.push(evento);
    // 17) Cache en memoria
    this.cache.push(evento);
    if (this.cache.length > this.cacheMax) this.cache.shift();

    this.guardarMemoria(memoria);

    // 18) Log detallado
    this.writeLog(`Entrenamiento: usuario=${usuario} disciplina=${disciplina} nivel=${nivel} id=${evento.id}`);

    return evento;
  }

  // 13) Generar respuesta enriquecida con plantillas por disciplina
  private generarRespuesta(consulta: string, disciplina: string, nivel: Nivel): string {
    const base = consulta.trim();
    if (!base) return "Consulta vacía.";

    // Encabezado con disciplina y nivel
    const header = this.plantillaRespuesta(base, disciplina, nivel);

    // Cierre breve con pauta metodológica genérica
    const cierre = `Nota: enfoque ${nivel} aplicado en ${disciplina}. Considera objetivo, método, evidencia y revisión.`;

    return `${header}\n${cierre}`;
  }

  // 15) Listado filtrado y búsqueda
  listarEventos(): EventoCientifico[] {
    return this.cargarMemoria();
  }

  filtrarPorDisciplina(disciplina: string): EventoCientifico[] {
    const d = this.sanitizar(disciplina.toLowerCase());
    return this.cargarMemoria().filter(e => e.disciplina.toLowerCase() === d);
  }

  filtrarPorNivel(nivel: Nivel): EventoCientifico[] {
    return this.cargarMemoria().filter(e => e.nivel === nivel);
  }

  buscarPorUsuario(usuario: string): EventoCientifico[] {
    const u = this.sanitizar(usuario);
    return this.cargarMemoria().filter(e => e.usuario === u);
  }

  buscarPorConsulta(palabra: string): EventoCientifico[] {
    const p = this.sanitizar(palabra.toLowerCase());
    return this.cargarMemoria().filter(e => e.consulta.toLowerCase().includes(p));
  }

  buscarPorTag(tag: string): EventoCientifico[] {
    const t = this.sanitizar(tag.toLowerCase());
    return this.cargarMemoria().filter(e => e.tags.map(x => x.toLowerCase()).includes(t));
  }

  // 9) Exportación
  exportarCSV(file: string = "santaolalla_export.csv"): string {
    const eventos = this.cargarMemoria();
    const lines = [
      ["id", "usuario", "timestamp", "disciplina", "nivel", "consulta", "respuesta", "tags"].join(","),
      ...eventos.map(e => [
        this.csvSafe(e.id),
        this.csvSafe(e.usuario),
        this.csvSafe(e.timestamp),
        this.csvSafe(e.disciplina),
        this.csvSafe(e.nivel),
        this.csvSafe(e.consulta),
        this.csvSafe(e.respuesta),
        this.csvSafe(e.tags.join("|")),
      ].join(","))
    ];
    const outPath = path.resolve(__dirname, file);
    fs.writeFileSync(outPath, lines.join("\n"), "utf-8");
    this.writeLog(`Exportación CSV: ${outPath}`);
    return outPath;
  }

  exportarMarkdown(file: string = "santaolalla_export.md"): string {
    const eventos = this.cargarMemoria();
    const lines: string[] = [
      "# Exportación de eventos — SantaOlallaTraining",
      "",
    ];
    for (const e of eventos) {
      lines.push(`## ${e.id}`);
      lines.push(`- Usuario: ${e.usuario}`);
      lines.push(`- Timestamp: ${e.timestamp}`);
      lines.push(`- Disciplina: ${e.disciplina}`);
      lines.push(`- Nivel: ${e.nivel}`);
      lines.push(`- Tags: ${e.tags.join(", ")}`);
      lines.push("");
      lines.push(`### Consulta`);
      lines.push(e.consulta);
      lines.push("");
      lines.push(`### Respuesta`);
      lines.push(e.respuesta);
      lines.push("");
      lines.push("---");
      lines.push("");
    }
    const outPath = path.resolve(__dirname, file);
    fs.writeFileSync(outPath, lines.join("\n"), "utf-8");
    this.writeLog(`Exportación Markdown: ${outPath}`);
    return outPath;
  }

  private csvSafe(s: string): string {
    const out = s.replace(/"/g, '""');
    if (/[,"\n]/.test(out)) return `"${out}"`;
    return out;
  }

  // 10) Importación
  importarJSON(file: string): number {
    const p = path.resolve(__dirname, file);
    const txt = this.safeRead(p);
    let datos: EventoCientifico[] = [];
    try {
      datos = JSON.parse(txt);
    } catch {
      this.writeLog(`Importación fallida (JSON inválido): ${p}`);
      return 0;
    }
    const memoria = this.cargarMemoria();
    const antes = memoria.length;
    for (const e of datos) {
      // validación mínima antes de fusionar
      if (e && e.id && e.usuario && e.consulta) memoria.push(e);
    }
    this.guardarMemoria(memoria);
    const añadidos = memoria.length - antes;
    this.writeLog(`Importados ${añadidos} eventos desde ${p}`);
    return añadidos;
  }

  // 16) Medición extendida en tiempo real
  estadoDB(): { db_bytes: number; memoria_mb: number; comprimido: boolean } {
    const bytes = fs.existsSync(this.dbPath) ? fs.statSync(this.dbPath).size : 0;
    const memMb = Math.round(process.memoryUsage().rss / (1024 * 1024));
    return { db_bytes: bytes, memoria_mb: memMb, comprimido: this.gzipEnabled };
  }

  // 17) Acceso a cache reciente
  ultimos(n: number = 10): EventoCientifico[] {
    return this.cache.slice(Math.max(this.cache.length - n, 0));
  }
}
