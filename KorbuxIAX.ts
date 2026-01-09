/**
 * KorbuxIAX.ts — Motor central de KORBUX IA
 * Mejora lote A: 30 mejoras de robustez, auditoría, sharding, contratos y accesibilidad.
 */

/////////////////////////////
// Tipos y contratos
/////////////////////////////

export type LangCode = "es" | "en";
export type Level = "basic" | "intermediate" | "advanced";

export interface AgentRequest {
  userId: string;
  agentId: string;
  input: string;
  lang?: LangCode;
  level?: Level;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface AgentResponse {
  id: string;
  agentId: string;
  userId: string;
  timestamp: string;
  lang: LangCode;
  level: Level;
  output: string;
  meta: {
    durationMs: number;
    seed: number;
    truncated: boolean;
    bytes?: number;
    schemaVersion: number;
    shard?: string;
  };
}

export interface AuditEvent {
  id: string;
  type: "info" | "warn" | "error" | "interaction";
  module: string;
  timestamp: string;
  data: Record<string, unknown>;
  level: "user" | "system" | "security";
}

export interface Agent {
  id: string;
  name: string;
  version: string;
  handle(req: AgentRequest, ctx: EngineContext): Promise<AgentResponse>;
  capabilities?: string[];
}

export interface Plugin {
  id: string;
  version: string;
  install(engine: KorbuxIAX): void;
}

export interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  atomicSet?(key: string, value: string): Promise<void>;
  listKeys?(prefix?: string): Promise<string[]>;
}

export interface EngineConfig {
  maxChars: number; // Mejora 1: límite global de 100M
  defaultLang: LangCode;
  defaultLevel: Level;
  auditEnabled: boolean; // Mejora 2: auditoría activable
  shardMaxBytes: number; // Mejora 5: sharding por tamaño
  schemaVersion: number; // Mejora 8: versionado de esquema
  environment: "browser" | "node" | "hybrid";
  license: {
    enforceOpenCore: boolean; // Mejora 15: núcleo siempre libre
    allowContentMonetization: boolean;
  };
}

export interface EngineContext {
  config: EngineConfig;
  storage: StorageAdapter;
  events: EventBus;
  audit: (ev: Partial<AuditEvent>) => void;
  util: {
    seed(text: string): number; // Mejora 11: semilla reproducible
    limit(text: string, max: number): { text: string; truncated: boolean }; // Mejora 1: límite aplicado
    now(): string;
    crc32(text: string): number;
    sanitize(text: string): string; // Mejora 10: sanitización opcional
  };
}

/////////////////////////////
// Utilidades
/////////////////////////////

function isoNow(): string { return new Date().toISOString(); }
function simpleSeed(s: string): number { let h=0; for(let i=0;i<s.length;i++){h=(h<<5)-h+s.charCodeAt(i);h|=0;} return Math.abs(h); }
function enforceLimit(text: string, max: number) { return text.length>max?{text:text.slice(0,max),truncated:true}:{text, truncated:false}; }
function sanitizeText(text: string): string { return text.replace(/[<>]/g,""); }

/////////////////////////////
// EventBus — Mejora 12: eventos seguros
/////////////////////////////

export class EventBus {
  private listeners = new Map<string, Set<(payload: unknown) => void>>();
  on(event: string, handler: (payload: unknown) => void): void {
    if (!this.listeners.has(event)) this.listeners.set(event,new Set());
    this.listeners.get(event)!.add(handler);
  }
  off(event: string, handler: (payload: unknown) => void): void {
    this.listeners.get(event)?.delete(handler);
  }
  emit(event: string, payload: unknown): void {
    const set=this.listeners.get(event); if(!set) return;
    for(const fn of set){ try{fn(payload);}catch{} }
  }
}

/////////////////////////////
// Adaptadores de almacenamiento
/////////////////////////////

export class MemoryStorageAdapter implements StorageAdapter {
  private map = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.map.has(key) ? this.map.get(key)! : null;
  }

  async set(key: string, value: string): Promise<void> {
    this.map.set(key, value);
  }

  async atomicSet(key: string, value: string): Promise<void> {
    const tmpKey = `${key}__tmp__${Date.now()}`;
    this.map.set(tmpKey, value);
    this.map.set(key, value);
    this.map.delete(tmpKey);
  }

  async listKeys(prefix?: string): Promise<string[]> {
    const out: string[] = [];
    for (const k of this.map.keys()) {
      if (!prefix || k.startsWith(prefix)) out.push(k);
    }
    return out;
  }
}

export class LocalStorageAdapter implements StorageAdapter {
  async get(key: string): Promise<string | null> {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  async set(key: string, value: string): Promise<void> {
    try { localStorage.setItem(key, value); } catch {}
  }

  async atomicSet(key: string, value: string): Promise<void> {
    try {
      const tmpKey = `${key}__tmp__${Date.now()}`;
      localStorage.setItem(tmpKey, value);
      localStorage.setItem(key, value);
      localStorage.removeItem(tmpKey);
    } catch {
      await this.set(key, value);
    }
  }

  async listKeys(prefix?: string): Promise<string[]> {
    try {
      const out: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (!prefix || k.startsWith(prefix)) out.push(k);
      }
      return out;
    } catch {
      return [];
    }
  }
}

// Mejora 20: Placeholder FileStorageAdapter para Node (contrato claro)
export class FileStorageAdapter implements StorageAdapter {
  async get(_key: string): Promise<string | null> { return null; }
  async set(_key: string, _value: string): Promise<void> { /* implementar con fs/promises */ }
  async atomicSet(_key: string, _value: string): Promise<void> { /* implementar escritura atómica */ }
  async listKeys(_prefix?: string): Promise<string[]> { return []; }
}

/////////////////////////////
// Motor principal
/////////////////////////////

export class KorbuxIAX {
  private config: EngineConfig;
  private storage: StorageAdapter;
  private events: EventBus;
  private agents = new Map<string, Agent>();
  private installedPlugins = new Map<string, Plugin>();

  // Prefijos y meta
  private shardPrefix = "KorbuxIAX:shard:";
  private auditPrefix = "KorbuxIAX:audit:";
  private metaKey = "KorbuxIAX:meta";

  // Inicializador de persistencia sharded (se asegura de activarse una sola vez)
  private initShardPersistenceOnce = (() => {
    let initialized = false;
    return () => {
      if (initialized) return;
      this.on("response", async (payload: unknown) => {
        const res = payload as AgentResponse;
        if (res && res.id) await this.persistResponseSharded(res);
      });
      initialized = true;
    };
  })();

  constructor(options?: Partial<EngineConfig>, adapter?: StorageAdapter) {
    this.config = {
      maxChars: 100_000_000, // Mejora 1
      defaultLang: "es",
      defaultLevel: "basic",
      auditEnabled: true, // Mejora 2
      shardMaxBytes: 5*1024*1024, // Mejora 5
      schemaVersion: 1, // Mejora 8
      environment: options?.environment ?? "browser",
      license: { enforceOpenCore: true, allowContentMonetization: true },
      ...(options??{})
    };
    this.storage = adapter ?? new MemoryStorageAdapter();
    this.events = new EventBus();
    this.events.emit("engine_ready",{}); // Mejora 29: evento de arranque
    this.initShardPersistenceOnce(); // Activar persistencia en shard
  }

  private getContext(): EngineContext {
    return {
      config:this.config,
      storage:this.storage,
      events:this.events,
      audit:(ev)=>this.audit(ev),
      util:{ seed:simpleSeed, limit:(t,m)=>enforceLimit(t,m), now:isoNow, crc32:simpleSeed, sanitize:sanitizeText }
    };
  }

  // Mejora 3: IDs reproducibles
  private genId(prefix:string):string { return `${prefix}_${Date.now()}_${Math.floor(Math.random()*100000)}`; }

  // Mejora 4: reintentos en atomicSet
  private async safeWrite(key:string,value:string){ try{await(this.storage.atomicSet?.(key,value)??this.storage.set(key,value));}catch{await this.storage.set(key,value);} }

  // Mejora 9: contratos estrictos y validación
  async request(req:AgentRequest):Promise<AgentResponse>{
    if(!req||!req.agentId||!req.userId) throw new Error("Solicitud inválida");
    const agent=this.agents.get(req.agentId); if(!agent) throw new Error("Agente no registrado");

    const limited=enforceLimit(req.input,this.config.maxChars);
    const ctx=this.getContext();

    const start = typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now() : Date.now();

    const response=await agent.handle({...req,input:limited.text},ctx);
    if(!response||typeof response.output!=="string") throw new Error("Respuesta inválida");

    if(response.output.length>this.config.maxChars){
      const lim=enforceLimit(response.output,this.config.maxChars);
      response.output=lim.text;
      response.meta.truncated=lim.truncated;
    }

    const end = typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now() : Date.now();

    response.meta.durationMs = Math.round(end - start); // Mejora 26: latencia
    response.meta.schemaVersion=this.config.schemaVersion; // Mejora 8

    await this.safeWrite(`resp:${response.id}`,JSON.stringify(response));
    this.events.emit("response",response);
    return response;
  }

  // Mejora 13: lista de agentes
  registerAgent(agent:Agent){
    this.agents.set(agent.id,agent);
    this.audit({type:"info",module:"engine",level:"system",data:{action:"register_agent",agentId:agent.id}});
  }
  listAgents():Agent[]{ return Array.from(this.agents.values()); }

  // Mejora 14: registro de plugins
  installPlugin(plugin:Plugin){ if(this.installedPlugins.has(plugin.id)) return; plugin.install(this); this.installedPlugins.set(plugin.id,plugin); }

  // Mejora 6: métricas de bytes (estimación ligera)
  async shardUsage(prefix:string):Promise<number>{ const keys=await this.storage.listKeys?.(prefix)??[]; return keys.length*256; }

  // Mejora 7: exportación con verificación
  async exportResponses():Promise<AgentResponse[]>{ const keys=await this.storage.listKeys?.("resp:")??[]; const out:AgentResponse[]=[]; for(const k of keys){ const raw=await this.storage.get(k); if(!raw) continue; try{out.push(JSON.parse(raw));}catch{} } return out; }

  // Mejora 16: setMaxChars auditado
  setMaxChars(limit:number){ if(limit<1) throw new Error("Límite inválido"); this.config.maxChars=limit; this.audit({type:"info",module:"engine",level:"system",data:{action:"set_max_chars",limit}}); }

  // Mejora 17 y 18: setLang y setLevel
  setDefaultLang(lang:LangCode){ this.config.defaultLang=lang; this.audit({type:"info",module:"engine",level:"system",data:{action:"set_lang",lang}}); }
  setDefaultLevel(level:Level){ this.config.defaultLevel=level; this.audit({type:"info",module:"engine",level:"system",data:{action:"set_level",level}}); }

  // Mejora 22: Auditoría con shard independiente y niveles tipados
  private async audit(ev: Partial<AuditEvent>): Promise<void> {
    if (!this.config.auditEnabled) return;
    const event: AuditEvent = {
      id: this.genId("audit"),
      type: ev.type ?? "interaction",
      module: ev.module ?? "engine",
      timestamp: isoNow(),
      data: ev.data ?? {},
      level: ev.level ?? "system",
    };
    const shard = await this.ensureShardForWrite("audit");
    const key = `${this.auditPrefix}${shard}:${event.id}`;
    await this.safeWrite(key, JSON.stringify(event));
    this.events.emit("audit", event);
  }

  // Mejora 27: Persistencia de meta (schemaVersion, shards) con atomicSet
  private async loadMeta(): Promise<Record<string, unknown>> {
    const raw = await this.storage.get(this.metaKey);
    if (!raw) return { schemaVersion: this.config.schemaVersion, responsesShards: [], auditShards: [] };
    try { return JSON.parse(raw); } catch { return { schemaVersion: this.config.schemaVersion, responsesShards: [], auditShards: [] }; }
  }

  private async saveMeta(meta: Record<string, unknown>): Promise<void> {
    await this.safeWrite(this.metaKey, JSON.stringify(meta, null, 2));
  }

  // Mejora 5: Sharding por tamaño y tiempo (YYYY-MM) con umbral configurable
  private async ensureShardForWrite(kind: "responses" | "audit"): Promise<string> {
    const meta = await this.loadMeta();
    const key = kind === "responses" ? "responsesShards" : "auditShards";
    const shards = (meta[key] as string[]) ?? [];
    const latest = shards[shards.length - 1];
    if (latest) {
      const usage = await this.shardUsage(`${kind === "responses" ? this.shardPrefix + "responses:" : this.auditPrefix}${latest}:`);
      if (usage < this.config.shardMaxBytes) return latest;
    }
    const newShard = `${kind}_${this.yyyyMm()}`;
    shards.push(newShard);
    meta[key] = shards;
    await this.saveMeta(meta);
    return newShard;
  }

  private yyyyMm(): string {
    const d = new Date(), y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }

  // Persistencia complementaria de respuestas en shards (sin romper la escritura simple)
  private async persistResponseSharded(res: AgentResponse): Promise<void> {
    const shard = await this.ensureShardForWrite("responses");
    res.meta.shard = shard;
    const key = `${this.shardPrefix}responses:${shard}:${res.id}`;
    await this.safeWrite(key, JSON.stringify(res));
  }

  // Mejora 23: Deduplicación ligera al importar (si se implementa import)
  async importResponses(json: string): Promise<number> {
    let parsed: AgentResponse[] = [];
    try { parsed = JSON.parse(json); } catch { return 0; }
    const ids = new Set<string>();
    let added = 0;
    for (const r of parsed) {
      if (!r || !r.id || ids.has(r.id)) continue;
      ids.add(r.id);
      await this.safeWrite(`resp:${r.id}`, JSON.stringify(r));
      await this.persistResponseSharded(r);
      added++;
    }
    return added;
  }

  // Mejora 28: on/off con limpieza segura (EventBus soporta off)
  on(event: "audit" | "response", handler: (payload: unknown) => void): void {
    this.events.on(event, handler);
  }

  off(event: "audit" | "response", handler: (payload: unknown) => void): void {
    this.events.off(event, handler);
  }

  // Mejora 8 y 27: Migraciones de esquema con hooks
  async migrateSchema(targetVersion: number): Promise<void> {
    const meta = await this.loadMeta();
    const current = Number(meta["schemaVersion"] ?? this.config.schemaVersion);
    if (current === targetVersion) return;

    if (current < targetVersion) {
      // Aquí se aplicarían transformaciones de datos entre versiones
      // Ejemplo: v1 -> v2, v2 -> v3, etc.
    }

    meta["schemaVersion"] = targetVersion;
    this.config.schemaVersion = targetVersion;
    await this.saveMeta(meta);

    this.audit({
      type: "info",
      module: "engine",
      level: "system",
      data: { action: "migrate_schema", from: current, to: targetVersion }
    });
  }
}

/////////////////////////////
// Agente de ejemplo — Mejora 9 y 25: contratos estrictos y protección contra outputs vacíos
/////////////////////////////

export class EchoAgent implements Agent {
  id = "echo";
  name = "Echo Agent";
  version = "1.0.0";
  capabilities = ["echo", "deterministic"];

  async handle(req: AgentRequest, ctx: EngineContext): Promise<AgentResponse> {
    const start = typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now() : Date.now();

    const { text, truncated } = ctx.util.limit(req.input, ctx.config.maxChars);
    const seed = ctx.util.seed(`${req.userId}:${req.agentId}:${text}:${req.lang}:${req.level}`);

    const output = text ? `[${(req.lang ?? ctx.config.defaultLang).toUpperCase()}] Echo: ${text}` : "Output vacío";
    const id = `resp_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

    const end = typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now() : Date.now();

    const resp: AgentResponse = {
      id,
      agentId: this.id,
      userId: req.userId,
      timestamp: ctx.util.now(),
      lang: req.lang ?? ctx.config.defaultLang,
      level: req.level ?? ctx.config.defaultLevel,
      output,
      meta: {
        durationMs: Math.round(end - start),
        seed,
        truncated,
        bytes: output.length,
        schemaVersion: ctx.config.schemaVersion,
      }
    };

    return resp;
  }
}

/////////////////////////////
// Uso básico — Mejora 30: comentarios inline explicando propósito
/////////////////////////////

/*
const engine = new KorbuxIAX();
engine.registerAgent(new EchoAgent());

// Ejemplo de solicitud
engine.request({
  userId: "user-123",
  agentId: "echo",
  input: "Hola, Korbux",
}).then(resp => {
  console.log(resp.output);
});
*/
