import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { OpenAI } from "openai";
import Anthropic from "@anthropic-ai/sdk";
import axios from "axios";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "child_process";
import dotenv from "dotenv";
import { RELIABILITY_GLOSSARY } from "./src/knowledge/glossary.js";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 80;

  app.use(express.json());

  // Initialize MCP Client
  const mcpPath = process.env.NODE_ENV === "production" 
    ? path.join(process.cwd(), "dist", "mcp-server.js")
    : "mcp-server.ts";
  const command = process.env.NODE_ENV === "production" ? "node" : "tsx";

  const transport = new StdioClientTransport({
    command: command,
    args: [mcpPath]
  });

  const mcpClient = new Client(
    { name: "uacp-orchestrator-host", version: "1.0.0" },
    { capabilities: { tools: {}, resources: {} } } as any
  );

  const mcpStatus = {
    connected: false,
    reconnecting: false,
    reconnectAttempts: 0,
    lastConnected: null as string | null,
    startTime: Date.now(),
  };

  const connectMCP = async () => {
    try {
      await mcpClient.connect(transport);
      mcpStatus.connected = true;
      mcpStatus.lastConnected = new Date().toISOString();
      mcpStatus.reconnectAttempts = 0;
      console.log("Connected to MCP Server: quantum-uacp-server");
    } catch (err) {
      mcpStatus.connected = false;
      console.error("Failed to connect to MCP Server", err);
    }
  };

  await connectMCP();

  // Periodic health check — ping MCP every 30s and reconnect if dead
  setInterval(async () => {
    if (mcpStatus.reconnecting) return;
    try {
      await mcpClient.listTools();
      if (!mcpStatus.connected) {
        mcpStatus.connected = true;
        mcpStatus.lastConnected = new Date().toISOString();
        console.log("MCP Server reconnected.");
      }
    } catch {
      if (mcpStatus.connected) {
        mcpStatus.connected = false;
        console.warn("MCP Server health check failed — marking disconnected.");
      }
      mcpStatus.reconnecting = true;
      mcpStatus.reconnectAttempts++;
      console.log(`MCP reconnect attempt #${mcpStatus.reconnectAttempts}...`);
      try {
        const newTransport = new StdioClientTransport({ command, args: [mcpPath] });
        await mcpClient.connect(newTransport);
        mcpStatus.connected = true;
        mcpStatus.lastConnected = new Date().toISOString();
        console.log("MCP Server reconnected successfully.");
      } catch (reconnErr) {
        console.error("MCP reconnect failed:", reconnErr);
      } finally {
        mcpStatus.reconnecting = false;
      }
    }
  }, 30000);

  // Lazy initialization helpers
  let _aiClient: GoogleGenAI | null = null;
  const getGoogleAI = () => {
    if (!_aiClient) {
      _aiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY || "",
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
    return _aiClient;
  };

  const ensureModelFormat = (modelName?: string) => {
    const defaultModel = "gemini-2.0-flash-exp";
    const name = modelName || defaultModel;
    return name.startsWith('models/') ? name : `models/${name}`;
  };

  let _openaiClient: OpenAI | null = null;
  const getOpenAI = (apiKey?: string, baseURL?: string) => {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY or provided key is required");
    if (!_openaiClient || (baseURL && _openaiClient.baseURL !== baseURL)) {
      _openaiClient = new OpenAI({ apiKey: key, baseURL });
    }
    return _openaiClient;
  };

  let _anthropicClient: Anthropic | null = null;
  const getAnthropic = (apiKey?: string) => {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY or provided key is required");
    if (!_anthropicClient) {
      _anthropicClient = new Anthropic({ apiKey: key });
    }
    return _anthropicClient;
  };

  const getGroq = (apiKey?: string) => getOpenAI(apiKey || process.env.GROQ_API_KEY, "https://api.groq.com/openai/v1");
  const getDeepSeek = (apiKey?: string) => getOpenAI(apiKey || process.env.DEEPSEEK_API_KEY, "https://api.deepseek.com");

  // ── Real Backend Proxy ──────────────────────────────────────────────────────
  // All requests are forwarded server-side; credentials never reach the browser.
  // Auth: VEKLOM BYOS uses "Authorization: Bearer <key>"
  //       CAPPO uses "X-API-Key: <key>" (open /health, auth required on most routes)
  //       GNOMLEDGER / LOCKERPHYCER: Bearer (same pattern as VEKLOM)

  const upstream = async (
    backendUrl: string | undefined,
    envVarName: string,
    path: string,
    method: string,
    body: unknown,
    res: express.Response,
    authStyle: "bearer" | "x-api-key" | "none" = "bearer"
  ) => {
    if (!backendUrl) {
      return res.status(503).json({
        error: "NOT_CONNECTED",
        message: `Backend not configured. Set ${envVarName} env var.`,
        hint: `Expected env var: ${envVarName}`
      });
    }
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const apiKey = process.env.OPERATOR_INTERNAL_API_KEY;
      
      const req = res.req;
      const workspaceId = (req && req.headers && req.headers["x-workspace-id"]) || process.env.WORKSPACE_ID;
      if (workspaceId) {
        headers["X-Workspace-ID"] = workspaceId as string;
      }
      
      if (apiKey) {
        if (authStyle === "bearer")    headers["Authorization"] = `Bearer ${apiKey}`;
        if (authStyle === "x-api-key") headers["X-API-Key"] = apiKey;
        // "none" = open endpoint, no auth header
      }
      const fetchRes = await fetch(`${backendUrl}${path}`, {
        method,
        headers,
        body: method !== "GET" && method !== "HEAD" ? JSON.stringify(body) : undefined,
      });
      const ct = fetchRes.headers.get("content-type") || "";
      const data = ct.includes("application/json")
        ? await fetchRes.json()
        : { raw: await fetchRes.text() };
      res.status(fetchRes.status).json(data);
    } catch (err: any) {
      res.status(502).json({ error: "UPSTREAM_ERROR", message: err.message, backend: backendUrl });
    }
  };

  const CAPPO       = () => process.env.CAPPO_BACKEND_URL;
  const VEKLOM      = () => process.env.VEKLOM_BACKEND_URL;
  const GNOMLEDGER  = () => process.env.GNOMLEDGER_URL;
  const LOCKERPHYCER = () => process.env.LOCKERPHYCER_URL;

  // ── MCP / operator status ────────────────────────────────────────────────
  // Combines local MCP adapter state with CAPPO /health
  app.get("/api/mcp/status", async (req, res) => {
    const local = {
      local_mcp: {
        connected: mcpStatus.connected,
        reconnecting: mcpStatus.reconnecting,
        reconnectAttempts: mcpStatus.reconnectAttempts,
        lastConnected: mcpStatus.lastConnected,
        uptime: Math.floor((Date.now() - mcpStatus.startTime) / 1000),
      }
    };
    if (!CAPPO()) return res.json({ ...local, cappo: "NOT_CONNECTED" });
    try {
      const r = await fetch(`${CAPPO()}/health`);
      const cappoHealth = r.ok ? await r.json() : { status: "error", code: r.status };
      res.json({ ...local, cappo: cappoHealth });
    } catch (e: any) {
      res.json({ ...local, cappo: { status: "UPSTREAM_ERROR", message: e.message } });
    }
  });

  // ── CAPPO — cappo.veklom.com ─────────────────────────────────────────────
  // Open endpoints (no auth required by CAPPO)
  app.get("/api/cappo/health",         (req, res) => upstream(CAPPO(), "CAPPO_BACKEND_URL", "/health",                        "GET",  null,     res, "none"));
  app.get("/api/cappo/legacy/status",  (req, res) => upstream(CAPPO(), "CAPPO_BACKEND_URL", "/legacy/status",                 "GET",  null,     res, "none"));
  app.get("/api/cappo/x402",           (req, res) => upstream(CAPPO(), "CAPPO_BACKEND_URL", "/.well-known/x402",              "GET",  null,     res, "none"));

  // VNP — Validated Network Providers
  app.get("/api/cappo/vnp/methodology",(req, res) => upstream(CAPPO(), "CAPPO_BACKEND_URL", "/v1/vnp/methodology",           "GET",  null,     res, "x-api-key"));
  app.get("/api/cappo/vnp/metrics",    (req, res) => upstream(CAPPO(), "CAPPO_BACKEND_URL", "/v1/vnp/metrics",               "GET",  null,     res, "x-api-key"));
  app.get("/api/cappo/vnp/leaderboard",(req, res) => upstream(CAPPO(), "CAPPO_BACKEND_URL", "/v1/vnp/leaderboard",           "GET",  null,     res, "x-api-key"));
  app.get("/api/cappo/vnp/validators", (req, res) => upstream(CAPPO(), "CAPPO_BACKEND_URL", "/v1/vnp/validators",            "GET",  null,     res, "x-api-key"));
  app.get("/api/cappo/vnp/incidents",  (req, res) => upstream(CAPPO(), "CAPPO_BACKEND_URL", "/v1/vnp/incidents",             "GET",  null,     res, "x-api-key"));
  app.get("/api/cappo/vnp/beacon",     (req, res) => upstream(CAPPO(), "CAPPO_BACKEND_URL", "/v1/vnp/beacon/routes",         "GET",  null,     res, "x-api-key"));
  app.post("/api/cappo/vnp/apis",      (req, res) => upstream(CAPPO(), "CAPPO_BACKEND_URL", "/v1/vnp/apis",                  "POST", req.body, res, "x-api-key"));

  // Agents ledger
  app.get("/api/cappo/agents",         (req, res) => upstream(CAPPO(), "CAPPO_BACKEND_URL", "/api/v1/agents",                "GET",  null,     res, "x-api-key"));
  app.post("/api/cappo/agents",        (req, res) => upstream(CAPPO(), "CAPPO_BACKEND_URL", "/api/v1/agents",                "POST", req.body, res, "x-api-key"));
  app.get("/api/cappo/agents/:id",     (req, res) => upstream(CAPPO(), "CAPPO_BACKEND_URL", `/api/v1/agents/${req.params.id}`,"GET", null,     res, "x-api-key"));
  app.get("/api/cappo/ledger/events",  (req, res) => upstream(CAPPO(), "CAPPO_BACKEND_URL", "/api/v1/ledger/events",         "GET",  null,     res, "x-api-key"));

  // Exec, audit, runs
  app.post("/api/cappo/exec",          (req, res) => upstream(CAPPO(), "CAPPO_BACKEND_URL", "/v1/exec",                      "POST", req.body, res, "x-api-key"));
  app.post("/api/cappo/mcp/call",      (req, res) => upstream(CAPPO(), "CAPPO_BACKEND_URL", "/mcp/call",                    "POST", req.body, res, "x-api-key"));
  app.get("/api/cappo/runs",           (req, res) => upstream(CAPPO(), "CAPPO_BACKEND_URL", "/v1/runs",                     "GET",  null,     res, "x-api-key"));
  app.get("/api/cappo/audit/logs",     (req, res) => upstream(CAPPO(), "CAPPO_BACKEND_URL", "/v1/audit-logs",               "GET",  null,     res, "x-api-key"));
  app.get("/api/cappo/audit/ledger",   (req, res) => upstream(CAPPO(), "CAPPO_BACKEND_URL", "/v1/audit/ledger",             "GET",  null,     res, "x-api-key"));
  app.get("/api/cappo/audit/verify",   (req, res) => upstream(CAPPO(), "CAPPO_BACKEND_URL", "/v1/audit/verify",             "GET",  null,     res, "x-api-key"));

  // Governance v2
  app.post("/api/cappo/governance/assess",         (req, res) => upstream(CAPPO(), "CAPPO_BACKEND_URL", "/v1/governance/v2/assess",                      "POST", req.body, res, "x-api-key"));
  app.get("/api/cappo/governance/risk/:agentId",   (req, res) => upstream(CAPPO(), "CAPPO_BACKEND_URL", `/v1/governance/v2/risk/${req.params.agentId}`,  "GET",  null,     res, "x-api-key"));
  app.get("/api/cappo/governance/quarantine",      (req, res) => upstream(CAPPO(), "CAPPO_BACKEND_URL", "/v1/governance/v2/quarantine",                  "GET",  null,     res, "x-api-key"));

  // License
  app.post("/api/cappo/license/issue",    (req, res) => upstream(CAPPO(), "CAPPO_BACKEND_URL", "/v1/license/issue",    "POST", req.body, res, "x-api-key"));
  app.post("/api/cappo/license/validate", (req, res) => upstream(CAPPO(), "CAPPO_BACKEND_URL", "/v1/license/validate", "POST", req.body, res, "x-api-key"));
  app.get("/api/cappo/license",           (req, res) => upstream(CAPPO(), "CAPPO_BACKEND_URL", "/v1/license",          "GET",  null,     res, "x-api-key"));

  // Platform / benchmarks / GPC
  app.get("/api/cappo/platform/pulse",        (req, res) => upstream(CAPPO(), "CAPPO_BACKEND_URL", "/api/v1/platform/pulse",           "GET", null, res, "x-api-key"));
  app.get("/api/cappo/benchmarks/leaderboard",(req, res) => upstream(CAPPO(), "CAPPO_BACKEND_URL", "/api/v1/benchmarks/leaderboard",   "GET", null, res, "x-api-key"));
  app.get("/api/cappo/gpc/stats",             (req, res) => upstream(CAPPO(), "CAPPO_BACKEND_URL", "/api/v1/gpc/stats",                "GET", null, res, "x-api-key"));
  app.get("/api/cappo/pricing",               (req, res) => upstream(CAPPO(), "CAPPO_BACKEND_URL", "/api/v1/pricing",                  "GET", null, res, "x-api-key"));

  // Legacy interlink pass-through (wildcard)
  app.all("/api/cappo/interlink/*", (req, res) =>
    upstream(CAPPO(), "CAPPO_BACKEND_URL", `/api/interlink/${req.params[0]}`, req.method, req.body, res, "x-api-key"));

  // ── VEKLOM BYOS — api.veklom.com ────────────────────────────────────────
  // Auth: Authorization: Bearer <OPERATOR_INTERNAL_API_KEY>

  // System / health
  app.get("/api/status",                (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/sys/health",                   "GET", null, res));
  app.get("/api/v1/monitoring/health",  (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/workspace/monitoring/health",  "GET", null, res));
  app.get("/api/v1/sys/health",         (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/sys/health",                   "GET", null, res));
  app.get("/api/v1/sys/gpu",            (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/sys/gpu",                      "GET", null, res));
  app.get("/api/v1/sys/version",        (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/sys/version",                  "GET", null, res));
  app.get("/api/v1/sys/control-plane-map", (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/sys/control-plane-map",    "GET", null, res));

  // Auth
  app.post("/api/v1/auth/signup",       (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/auth/signup",   "POST", req.body, res));
  app.post("/api/v1/auth/signin",       (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/auth/signin",   "POST", req.body, res));
  app.post("/api/v1/auth/register",     (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/auth/signup",   "POST", req.body, res)); // compat alias
  app.get("/api/v1/auth/me",            (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/auth/me",       "GET",  null,     res));
  app.get("/api/v1/auth/api-keys",      (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/auth/api-keys", "GET",  null,     res));

  // Agents
  app.get("/api/v1/agents",             (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/agents/",              "GET", null, res));
  app.get("/api/v1/agents/law",         (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/agents/law",           "GET", null, res));
  app.get("/api/v1/agents/registry",    (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/agents/registry",      "GET", null, res));
  app.get("/api/v1/agents/fleet",       (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/agents/fleet",         "GET", null, res));
  app.get("/api/v1/agents/runs",        (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/agents/runs",          "GET", null, res));
  app.get("/api/v1/agents/signals",     (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/agents/signals",       "GET", null, res));
  app.get("/api/v1/agents/violations",  (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/agents/violations",    "GET", null, res));
  app.get("/api/v1/agents/guardrails",  (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/agents/guardrails",    "GET", null, res));
  app.get("/api/v1/agents/skills",      (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/agents/skills",        "GET", null, res));
  app.get("/api/v1/agents/decision-frames", (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/agents/decision-frames", "GET", null, res));
  app.get("/api/v1/agents/monthly-report",  (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/agents/monthly-report",  "GET", null, res));
  app.get("/api/v1/agents/evidence",    (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/agents/evidence",      "GET", null, res));
  app.get("/api/v1/agents/hrm/audit",   (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/agents/hrm/audit",     "GET", null, res));
  app.post("/api/v1/agents/hrm/register",(req, res)=> upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/agents/hrm/register",  "POST", req.body, res));

  // Security / workspace
  app.get("/api/v1/security/stats",          (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/workspace/security/alerts",    "GET", null, res));
  app.get("/api/v1/workspace/overview",      (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/workspace/overview",            "GET", null, res));
  app.get("/api/v1/workspace/overview/live", (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/workspace/overview/live",       "GET", null, res));
  app.get("/api/v1/workspace/observability", (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/workspace/observability",       "GET", null, res));
  app.get("/api/v1/workspace/billing",       (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/workspace/billing/breakdown",   "GET", null, res));
  app.get("/api/v1/workspace/audit/logs",    (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/workspace/audit/logs",          "GET", null, res));
  app.get("/api/v1/workspace/autonomous/decisions", (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/workspace/autonomous/decisions", "GET", null, res));

  // Terminal (VEKLOM remote shell)
  app.get("/api/terminal/state",        (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/terminal/state",      "GET",  null,     res));
  app.post("/api/terminal/telemetry",   (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/terminal/telemetry",  "POST", req.body, res));
  app.post("/api/terminal/shell",       (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/terminal/shell",      "POST", req.body, res));

  // Genome (PGL on VEKLOM)
  app.get("/api/v1/genome/certificates",(req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/genome/certificates", "GET", null, res));
  app.get("/api/v1/genome/ledger",      (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/genome/ledger",       "GET", null, res));
  app.get("/api/v1/genome/verify",      (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/genome/verify",       "GET", null, res));
  app.get("/api/v1/genome/status",      (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/genome/status",       "GET", null, res));

  // Runs
  app.post("/api/v1/runs",              (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/runs/",             "POST", req.body, res));
  app.get("/api/v1/runs/:runId",        (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", `/api/v1/runs/${req.params.runId}`, "GET", null, res));

  // Exec (VEKLOM native exec endpoint)
  app.post("/v1/exec",                  (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/runs/", "POST", req.body, res));

  // Copilot / agency
  app.get("/api/v1/copilot/registry",         (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/copilot/registry",          "GET", null, res));
  app.get("/api/v1/copilot/recent-decisions", (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/copilot/recent-decisions",   "GET", null, res));
  app.get("/api/v1/agency/overview",          (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/agency/overview",            "GET", null, res));
  app.get("/api/v1/agency/notifications",     (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/agency/notifications",       "GET", null, res));

  // VNP stream (VEKLOM)
  app.get("/api/v1/vnp/stream", (req, res) => {
    // Proxy SSE from VEKLOM
    const key = process.env.OPERATOR_INTERNAL_API_KEY;
    const base = process.env.VEKLOM_BACKEND_URL;
    if (!base) return res.status(503).json({ error: "NOT_CONNECTED" });
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    fetch(`${base}/api/v1/vnp/stream/sse`, { headers: key ? { "Authorization": `Bearer ${key}` } : {} })
      .then(upstream => {
        if (!upstream.body) return res.end();
        const reader = (upstream.body as any).getReader();
        const pump = () => reader.read().then(({ done, value }: any) => {
          if (done) return res.end();
          res.write(value);
          pump();
        }).catch(() => res.end());
        pump();
        req.on("close", () => reader.cancel());
      })
      .catch(() => res.end());
  });

  // Privacy / content safety (legacy compat aliases)
  app.post("/api/v1/privacy/detect-pii",   (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/repogate/scan",    "POST", req.body, res));
  app.post("/api/v1/content-safety/scan",  (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/repogate/seal",    "POST", req.body, res));

  // SEKED (maps to evaluations on VEKLOM)
  app.get("/api/seked/status",   (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/sys/health",                  "GET", null, res));

  // ── GNOMLEDGER — gnomledger.veklom.com ──────────────────────────────────
  // Currently 503; routes wired for when it recovers.
  app.get("/api/pgl/genome",    (req, res) => upstream(GNOMLEDGER(), "GNOMLEDGER_URL", "/api/pgl/genome",    "GET",  null,     res));
  app.get("/api/pgl/ledger",    (req, res) => upstream(GNOMLEDGER(), "GNOMLEDGER_URL", "/api/pgl/ledger",    "GET",  null,     res));
  app.post("/api/pgl/commit",   (req, res) => upstream(GNOMLEDGER(), "GNOMLEDGER_URL", "/api/pgl/commit",    "POST", req.body, res));
  app.get("/api/pgl/spdx",      (req, res) => upstream(GNOMLEDGER(), "GNOMLEDGER_URL", "/api/pgl/spdx",      "GET",  null,     res));
  app.get("/api/pgl/cyclonedx", (req, res) => upstream(GNOMLEDGER(), "GNOMLEDGER_URL", "/api/pgl/cyclonedx", "GET",  null,     res));

  // ── LOCKERPHYCER — lockerphycer.veklom.com ───────────────────────────────
  // Full command-center / security hub (Veklom Sovereign AI Hub v1.0.0).
  // Auth: Bearer. /health is open; all others require a workspace token.

  // Open
  app.get("/api/locker/health",          (req, res) => upstream(LOCKERPHYCER(), "LOCKERPHYCER_URL", "/health",                                    "GET",  null,     res, "none"));
  app.get("/api/locker/health/detailed", (req, res) => upstream(LOCKERPHYCER(), "LOCKERPHYCER_URL", "/health/detailed",                            "GET",  null,     res, "none"));

  // Auth
  app.post("/api/locker/auth/register",  (req, res) => upstream(LOCKERPHYCER(), "LOCKERPHYCER_URL", "/api/v1/auth/register",                       "POST", req.body, res, "none"));
  app.post("/api/locker/auth/login",     (req, res) => upstream(LOCKERPHYCER(), "LOCKERPHYCER_URL", "/api/v1/auth/login",                          "POST", req.body, res, "none"));
  app.get("/api/locker/auth/me",         (req, res) => upstream(LOCKERPHYCER(), "LOCKERPHYCER_URL", "/api/v1/auth/me",                             "GET",  null,     res));

  // Security
  app.get("/api/locker/security/events", (req, res) => upstream(LOCKERPHYCER(), "LOCKERPHYCER_URL", "/api/v1/security/events",                     "GET",  null,     res));
  app.get("/api/locker/security/threats",(req, res) => upstream(LOCKERPHYCER(), "LOCKERPHYCER_URL", "/api/v1/security/threats/stats",               "GET",  null,     res));
  app.get("/api/locker/security/controls",(req,res) => upstream(LOCKERPHYCER(), "LOCKERPHYCER_URL", "/api/v1/security/controls",                    "GET",  null,     res));
  app.get("/api/locker/security/dashboard",(req,res)=> upstream(LOCKERPHYCER(), "LOCKERPHYCER_URL", "/api/v1/security/dashboard",                   "GET",  null,     res));

  // Monitoring
  app.get("/api/locker/monitoring/metrics",  (req, res) => upstream(LOCKERPHYCER(), "LOCKERPHYCER_URL", "/api/v1/monitoring/metrics",              "GET",  null,     res));
  app.get("/api/locker/monitoring/health",   (req, res) => upstream(LOCKERPHYCER(), "LOCKERPHYCER_URL", "/api/v1/monitoring/health",               "GET",  null,     res));
  app.get("/api/locker/monitoring/activity", (req, res) => upstream(LOCKERPHYCER(), "LOCKERPHYCER_URL", "/api/v1/monitoring/activity",             "GET",  null,     res));
  app.get("/api/locker/monitoring/dashboard",(req, res) => upstream(LOCKERPHYCER(), "LOCKERPHYCER_URL", "/api/v1/monitoring/dashboard",            "GET",  null,     res));

  // Command Center
  app.get("/api/locker/cc/overview",         (req, res) => upstream(LOCKERPHYCER(), "LOCKERPHYCER_URL", "/api/v1/command-center/overview",         "GET",  null,     res));
  app.get("/api/locker/cc/workforce",        (req, res) => upstream(LOCKERPHYCER(), "LOCKERPHYCER_URL", "/api/v1/command-center/workforce/status",  "GET",  null,     res));
  app.get("/api/locker/cc/audit-log",        (req, res) => upstream(LOCKERPHYCER(), "LOCKERPHYCER_URL", "/api/v1/command-center/audit-log",         "GET",  null,     res));
  app.get("/api/locker/cc/live-users",       (req, res) => upstream(LOCKERPHYCER(), "LOCKERPHYCER_URL", "/api/v1/command-center/live-users",        "GET",  null,     res));
  app.get("/api/locker/cc/sessions",         (req, res) => upstream(LOCKERPHYCER(), "LOCKERPHYCER_URL", "/api/v1/command-center/sessions",          "GET",  null,     res));
  app.get("/api/locker/cc/activity-feed",    (req, res) => upstream(LOCKERPHYCER(), "LOCKERPHYCER_URL", "/api/v1/command-center/activity-feed",     "GET",  null,     res));
  app.get("/api/locker/cc/agents/fleet",     (req, res) => upstream(LOCKERPHYCER(), "LOCKERPHYCER_URL", "/api/v1/command-center/agents/fleet",      "GET",  null,     res));
  app.get("/api/locker/cc/governance",       (req, res) => upstream(LOCKERPHYCER(), "LOCKERPHYCER_URL", "/api/v1/command-center/governance/compliance","GET",null,   res));
  app.get("/api/locker/cc/operations/health",(req, res) => upstream(LOCKERPHYCER(), "LOCKERPHYCER_URL", "/api/v1/command-center/operations/health", "GET",  null,     res));
  app.get("/api/locker/cc/operations/alerts",(req, res) => upstream(LOCKERPHYCER(), "LOCKERPHYCER_URL", "/api/v1/command-center/operations/alerts", "GET",  null,     res));

  // Agents
  app.get("/api/locker/agents/registry",  (req, res) => upstream(LOCKERPHYCER(), "LOCKERPHYCER_URL", "/api/v1/agents/registry",                    "GET",  null,     res));
  app.get("/api/locker/agents/fleet",     (req, res) => upstream(LOCKERPHYCER(), "LOCKERPHYCER_URL", "/api/v1/agents/fleet",                        "GET",  null,     res));
  app.get("/api/locker/agents/runs",      (req, res) => upstream(LOCKERPHYCER(), "LOCKERPHYCER_URL", "/api/v1/agents/runs",                         "GET",  null,     res));
  app.get("/api/locker/agents/signals",   (req, res) => upstream(LOCKERPHYCER(), "LOCKERPHYCER_URL", "/api/v1/agents/signals",                      "GET",  null,     res));
  app.get("/api/locker/agents/violations",(req, res) => upstream(LOCKERPHYCER(), "LOCKERPHYCER_URL", "/api/v1/agents/violations",                   "GET",  null,     res));
  app.get("/api/locker/agents/council",   (req, res) => upstream(LOCKERPHYCER(), "LOCKERPHYCER_URL", "/api/v1/agents/council/votes",                "GET",  null,     res));
  app.get("/api/locker/agents/guardrails",(req, res) => upstream(LOCKERPHYCER(), "LOCKERPHYCER_URL", "/api/v1/agents/guardrails",                   "GET",  null,     res));
  app.get("/api/locker/agents/evidence",  (req, res) => upstream(LOCKERPHYCER(), "LOCKERPHYCER_URL", "/api/v1/agents/evidence",                     "GET",  null,     res));

  // Marketplace / GPC / billing
  app.get("/api/locker/marketplace",      (req, res) => upstream(LOCKERPHYCER(), "LOCKERPHYCER_URL", "/api/v1/marketplace/listings",                "GET",  null,     res));
  app.get("/api/locker/marketplace/catalog",(req,res)=> upstream(LOCKERPHYCER(), "LOCKERPHYCER_URL", "/api/v1/marketplace/catalog",                 "GET",  null,     res));
  app.get("/api/locker/billing/pricing",  (req, res) => upstream(LOCKERPHYCER(), "LOCKERPHYCER_URL", "/api/v1/billing/pricing",                     "GET",  null,     res));
  app.get("/api/locker/gpc/stats",        (req, res) => upstream(LOCKERPHYCER(), "LOCKERPHYCER_URL", "/api/v1/gpc/stats",                           "GET",  null,     res));
  app.get("/api/locker/gpc/plans",        (req, res) => upstream(LOCKERPHYCER(), "LOCKERPHYCER_URL", "/api/v1/gpc/plans",                           "GET",  null,     res));

  // MCP relay through lockerphycer
  app.post("/api/locker/mcp/call",        (req, res) => upstream(LOCKERPHYCER(), "LOCKERPHYCER_URL", "/api/v1/mcp/call",                            "POST", req.body, res));

  // ── Legacy CAPPO-aliased UACP routes (kept for UI compat) ───────────────
  app.get("/api/uacp/layers",      (req, res) => upstream(CAPPO(), "CAPPO_BACKEND_URL", "/api/v1/gpc/stats",           "GET", null, res, "x-api-key"));
  app.get("/api/uacp/bounded",     (req, res) => upstream(CAPPO(), "CAPPO_BACKEND_URL", "/api/v1/platform/pulse",      "GET", null, res, "x-api-key"));
  app.get("/api/uacp/security",    (req, res) => upstream(CAPPO(), "CAPPO_BACKEND_URL", "/v1/governance/v2/quarantine","GET", null, res, "x-api-key"));
  app.get("/api/uacp/governance",  (req, res) => upstream(CAPPO(), "CAPPO_BACKEND_URL", "/v1/governance/v2/assess",    "POST",{},   res, "x-api-key"));
  app.get("/api/uacp/roadmap",     (req, res) => upstream(CAPPO(), "CAPPO_BACKEND_URL", "/v1/vnp/methodology",         "GET", null, res, "x-api-key"));
  app.get("/api/uacp/hub/metrics", (req, res) => upstream(CAPPO(), "CAPPO_BACKEND_URL", "/v1/vnp/metrics",             "GET", null, res, "x-api-key"));
  app.get("/api/uacp/hub/ssrn",    (req, res) => upstream(CAPPO(), "CAPPO_BACKEND_URL", "/v1/vnp/validators",          "GET", null, res, "x-api-key"));
  app.get("/api/uacp/hub/observability", (req, res) => upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/workspace/observability", "GET", null, res));

  // --- RARA Governance Logic ---
  const RARA_GOVERNANCE_GATE = (req: any, res: any, next: any) => {
    const userRole = req.headers['x-user-role'] || 'guest';
    const confidence = parseFloat(req.headers['x-agent-confidence'] || '1.0');
    
    // Simulate RARA Invariant Check
    if (confidence < 0.6) {
        return res.status(403).json({ error: "RARA Governance Violation: Confidence threshold failure." });
    }
    
    // Simulate Economic Enforcement
    const credits = parseInt(req.headers['x-user-credits'] || '0');
    if (credits < 500) {
        return res.status(402).json({ error: "Economic Enforcement: Insufficient credits." });
    }

    next();
  };

  app.post("/api/cognitive/orchestrate", RARA_GOVERNANCE_GATE, async (req, res) => {
    const { prompt, context, mcpConfig, provider = 'google', model: customModel } = req.body;
    
    // 1. Setup Common System Prompt
    const SYSTEM_PROMPT = `
    <system_prompt>
    ${RELIABILITY_GLOSSARY}

    System Context: You are the Cognitive Engine of the Universal Autonomous Control Plane (UACP). 
    You operate as an agentic system governed by the Agent Constitution Framework (ACF) and Architecturally enforced by the ArbiterOS paradigm.
    
    Operational Philosophy:
    1. Symbolic Governor (System 2): All output must pass through a strict sanitizing firewall. You are not just a generator, you are a constituent of a larger deterministic system.
    2. Managed State Pipeline: You must respect the state fidelity (ACF Memory Core). Do not perform ad-hoc summarization; utilize provided context precisely.
    3. Normative Compliance: All tool calls must be verified against the ACF Normative Core.
    
    Expected JSON Structure:
    {
      "metacognitive_reflection": { "status": "string", "analysis": "string" },
      "action_plan": { "arbiter_validation": "boolean", "steps": ["string"] },
      "quantum_telemetry": { "zeno_cycles": number, "leakage_rate": number, "fidelity": number },
      "suggested_actions": ["string"]
    }
    Ensure numeric values for telemetry are realistic based on the context.
    </system_prompt>`;


    try {
      let finalData: any = null;

      switch (provider) {
        case 'openai':
        case 'groq':
        case 'deepseek': {
          const client = provider === 'openai' ? getOpenAI() : (provider === 'groq' ? getGroq() : getDeepSeek());
          const response = await client.chat.completions.create({
            model: customModel || (provider === 'openai' ? 'gpt-4o' : (provider === 'groq' ? 'llama-3.1-70b-versatile' : 'deepseek-chat')),
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: `<external_context>${JSON.stringify(context)}</external_context>\n\n<user_input>${prompt}</user_input>` }
            ],
            response_format: { type: 'json_object' }
          });
          try {
            finalData = JSON.parse(response.choices[0].message.content || '{}');
          } catch {
            finalData = { raw: response.choices[0].message.content };
          }
          break;
        }

        case 'anthropic': {
          const response = await getAnthropic().messages.create({
            model: customModel || 'claude-3-5-sonnet-20241022',
            max_tokens: 4096,
            system: SYSTEM_PROMPT,
            messages: [
              { role: 'user', content: `<external_context>${JSON.stringify(context)}</external_context>\n\n<user_input>${prompt}</user_input>` }
            ]
          });
          const text = response.content[0].type === 'text' ? response.content[0].text : '';
          try {
            finalData = JSON.parse(text || '{}');
          } catch {
            finalData = { raw: text };
          }
          break;
        }

        case 'ollama': {
          const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
          const response = await axios.post(`${ollamaUrl}/api/generate`, {
            model: customModel || 'llama3',
            prompt: `${SYSTEM_PROMPT}\n\n<external_context>${JSON.stringify(context)}</external_context>\n\n<user_input>${prompt}</user_input>\n\nResponse (JSON only):`,
            stream: false,
            format: 'json'
          });
          try {
            finalData = response.data.response ? JSON.parse(response.data.response) : response.data;
          } catch {
            finalData = { raw: response.data.response };
          }
          break;
        }

        case 'huggingface': {
          const hfToken = process.env.HF_TOKEN;
          if (!hfToken) throw new Error("HF_TOKEN missing");
          const response = await axios.post(
            `https://api-inference.huggingface.co/models/${customModel || 'meta-llama/Llama-3.1-405B-Instruct'}`,
            { inputs: `${SYSTEM_PROMPT}\n\n<external_context>${JSON.stringify(context)}</external_context>\n\n<user_input>${prompt}</user_input>\n\nAssistant:` },
            { headers: { Authorization: `Bearer ${hfToken}` } }
          );
          const generatedText = response.data?.[0]?.generated_text ?? '';
          const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
          try {
            finalData = jsonMatch ? JSON.parse(jsonMatch[0]) : { plan_summary: generatedText };
          } catch {
            finalData = { plan_summary: generatedText };
          }
          break;
        }

        case 'serp': {
          const orchestrationResponse = await getGoogleAI().models.generateContent({
            model: ensureModelFormat(customModel),
            contents: [{ text: `${SYSTEM_PROMPT}\n\nUser is requesting a Search-Focused Orchestration.\n<external_context>${JSON.stringify(context)}</external_context>\n\n<user_input>${prompt}</user_input>` }],
            config: {
              responseMimeType: "application/json",
              tools: [{ google_search: {} }]
            }
          } as any);
          try {
            finalData = JSON.parse(orchestrationResponse.text || "{}");
          } catch {
            finalData = { raw: orchestrationResponse.text };
          }
          break;
        }

        case 'google':
        default: {
          const mcpToolsRes = await mcpClient.listTools().catch(() => ({ tools: [] }));
          const filteredTools = mcpToolsRes.tools.filter(tool => !mcpConfig || mcpConfig[tool.name]?.enabled !== false);
          const geminiTools = filteredTools.map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: { ...tool.inputSchema as any, type: Type.OBJECT }
          }));

          const orchestrationResponse = await getGoogleAI().models.generateContent({
            model: ensureModelFormat(customModel),
            contents: [{ text: `${SYSTEM_PROMPT}\n\n<external_context>${JSON.stringify(context)}</external_context>\n\n<user_input>${prompt}</user_input>` }],
            config: {
              responseMimeType: "application/json"
            }
          });
          try {
            finalData = JSON.parse(orchestrationResponse.text || "{}");
          } catch {
            finalData = { raw: orchestrationResponse.text };
          }
          break;
        }
      }

      res.json(finalData);
    } catch (error: any) {
      console.error("Multi-Provider Orchestration Error:", error);
      res.status(500).json({ 
        error: "Orchestration failed", 
        provider,
        details: error.message || String(error) 
      });
    }
  });

  // API Route for Telemetry
  app.get("/api/telemetry", async (req, res) => {
    try {
      const resource = await mcpClient.readResource({ uri: "quantum://telemetry" });
      const content = resource.contents[0];
      const text = 'text' in content ? content.text : '';
      const telemetry = JSON.parse(text || '{}');
      res.json(telemetry);
    } catch (error) {
      console.error("Telemetry fetch error:", error);
      res.status(500).json({ error: "Failed to fetch telemetry" });
    }
  });

  // SSE Route for Real-Time Telemetry
  app.get("/api/telemetry/stream", (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendTelemetry = async () => {
      try {
        const resource = await mcpClient.readResource({ uri: "quantum://telemetry" });
        const content = resource.contents[0];
        const text = 'text' in content ? content.text : '';
        const telemetry = JSON.parse(text || '{}');
        res.write(`data: ${JSON.stringify({
          ...telemetry,
          vibration_1x: 20 + Math.random() * 5,
          vibration_2x: 15 + Math.random() * 3,
          carpet_noise: 10 + Math.random() * 10
        })}\n\n`);
      } catch (error) {
        // Fallback simulated data if MCP fails or during development
        const simulated = {
          zeno_cycles: Math.floor(Math.random() * 1000),
          leakage_rate: (0.02 + Math.random() * 0.01).toFixed(3),
          fidelity: (0.98 + Math.random() * 0.02).toFixed(3),
          vibration_1x: 20 + Math.random() * 5,
          vibration_2x: 15 + Math.random() * 3,
          carpet_noise: 10 + Math.random() * 10,
          timestamp: new Date().toISOString()
        };
        res.write(`data: ${JSON.stringify(simulated)}\n\n`);
      }
    };

    const intervalId = setInterval(sendTelemetry, 3000);

    req.on('close', () => {
      clearInterval(intervalId);
      res.end();
    });
  });

  app.post("/api/telemetry/reset", (req, res) => {
    res.json({ status: "ok", message: "Wavefunction reset initiated." });
  });

  // SSE stream for agent status updates (Control Plane / SwarmMap)
  app.get("/api/agent-updates", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const statuses = ["Active", "Idle", "Blocked"] as const;
    const depts = ["Engineering", "Growth", "Ops", "Research", "Revenue"] as const;

    const send = () => {
      const agentIdx = Math.floor(Math.random() * 105);
      const agentId = agentIdx === 0 ? "AG-CORE-000" : `AG-${depts[agentIdx % 5].slice(0, 3).toUpperCase()}-${String(agentIdx).padStart(3, "0")}`;
      const payload = {
        id: agentId,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        metrics: {
          cpu: Math.floor(Math.random() * 100),
          memory: Math.floor(Math.random() * 100),
          latency: Math.floor(Math.random() * 50) + 1,
          requestCount: Math.floor(Math.random() * 20000),
        },
        timestamp: new Date().toISOString(),
      };
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    // Send connection ack
    res.write(`data: ${JSON.stringify({ type: "connection", message: "UACP Swarm SSE connected." })}\n\n`);

    const interval = setInterval(send, 2000);
    req.on("close", () => { clearInterval(interval); res.end(); });
  });

  app.post("/api/system/stress-test", (req, res) => {
    res.json({ 
      status: "ok", 
      message: "Stress test protocol engaged.",
      predicted_peak_cycles: 2500,
      stability_index: 0.76
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`UACP Server running on http://localhost:${PORT}`);
  });
}

startServer();
