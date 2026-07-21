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
  const PORT = 3000;

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
  // All requests are forwarded server-side; no credentials ever reach the browser.

  const upstream = async (
    backendUrl: string | undefined,
    envVarName: string,
    path: string,
    method: string,
    body: unknown,
    res: express.Response
  ) => {
    if (!backendUrl) {
      return res.status(503).json({
        error: "NOT_CONNECTED",
        message: `Backend not configured. Set ${envVarName} in Replit Secrets.`,
        hint: `Expected env var: ${envVarName}`
      });
    }
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const apiKey = process.env.OPERATOR_INTERNAL_API_KEY;
      if (apiKey) headers["X-API-Key"] = apiKey;

      const fetchRes = await fetch(`${backendUrl}${path}`, {
        method,
        headers,
        body: method !== "GET" && method !== "HEAD" ? JSON.stringify(body) : undefined,
      });
      let data: any;
      const ct = fetchRes.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        data = await fetchRes.json();
      } else {
        data = { raw: await fetchRes.text() };
      }
      res.status(fetchRes.status).json(data);
    } catch (err: any) {
      res.status(502).json({ error: "UPSTREAM_ERROR", message: err.message, backend: backendUrl });
    }
  };

  const CAPPO  = () => process.env.CAPPO_BACKEND_URL;
  const VEKLOM = () => process.env.VEKLOM_BACKEND_URL;
  const GNOMLEDGER = () => process.env.GNOMLEDGER_URL;

  // MCP status — cappo-backend
  app.get("/api/mcp/status", (req, res) => {
    // Always include local MCP health alongside the upstream response
    const local = {
      local_mcp: {
        connected: mcpStatus.connected,
        reconnecting: mcpStatus.reconnecting,
        reconnectAttempts: mcpStatus.reconnectAttempts,
        lastConnected: mcpStatus.lastConnected,
        uptime: Math.floor((Date.now() - mcpStatus.startTime) / 1000),
      }
    };
    if (!CAPPO()) {
      return res.json({ ...local, upstream: "NOT_CONNECTED", hint: "Set CAPPO_BACKEND_URL" });
    }
    upstream(CAPPO(), "CAPPO_BACKEND_URL", "/mcp/status", "GET", null, res);
  });

  // General health — veklom-byos-backend
  app.get("/api/status", (req, res) =>
    upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/monitoring/health", "GET", null, res));

  app.get("/api/v1/monitoring/health", (req, res) =>
    upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/monitoring/health", "GET", null, res));

  app.get("/api/v1/security/stats", (req, res) =>
    upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/security/stats", "GET", null, res));

  app.post("/api/v1/privacy/detect-pii", (req, res) =>
    upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/privacy/detect-pii", "POST", req.body, res));

  app.post("/v1/exec", (req, res) =>
    upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/v1/exec", "POST", req.body, res));

  app.post("/api/v1/auth/register", (req, res) =>
    upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/auth/register", "POST", req.body, res));

  app.post("/api/v1/cost/predict", (req, res) =>
    upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/cost/predict", "POST", req.body, res));

  app.post("/api/v1/content-safety/scan", (req, res) =>
    upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/v1/content-safety/scan", "POST", req.body, res));

  // Climate — veklom-byos-backend
  app.get("/api/climate/emissions", (req, res) =>
    upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/climate/emissions", "GET", null, res));

  app.get("/api/climate/regional", (req, res) =>
    upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/climate/regional", "GET", null, res));

  // PGL / GnomLedger
  app.get("/api/pgl/genome", (req, res) =>
    upstream(GNOMLEDGER(), "GNOMLEDGER_URL", "/api/pgl/genome", "GET", null, res));

  app.get("/api/pgl/ledger", (req, res) =>
    upstream(GNOMLEDGER(), "GNOMLEDGER_URL", "/api/pgl/ledger", "GET", null, res));

  app.post("/api/pgl/commit", (req, res) =>
    upstream(GNOMLEDGER(), "GNOMLEDGER_URL", "/api/pgl/commit", "POST", req.body, res));

  app.get("/api/pgl/spdx", (req, res) =>
    upstream(GNOMLEDGER(), "GNOMLEDGER_URL", "/api/pgl/spdx", "GET", null, res));

  app.get("/api/pgl/cyclonedx", (req, res) =>
    upstream(GNOMLEDGER(), "GNOMLEDGER_URL", "/api/pgl/cyclonedx", "GET", null, res));

  // SEKED — veklom-byos-backend
  app.get("/api/seked/status", (req, res) =>
    upstream(VEKLOM(), "VEKLOM_BACKEND_URL", "/api/seked/status", "GET", null, res));

  // UACP layers — cappo-backend
  app.get("/api/uacp/layers", (req, res) =>
    upstream(CAPPO(), "CAPPO_BACKEND_URL", "/api/uacp/layers", "GET", null, res));

  app.get("/api/uacp/bounded", (req, res) =>
    upstream(CAPPO(), "CAPPO_BACKEND_URL", "/api/uacp/bounded", "GET", null, res));

  app.get("/api/uacp/security", (req, res) =>
    upstream(CAPPO(), "CAPPO_BACKEND_URL", "/api/uacp/security", "GET", null, res));

  app.get("/api/uacp/governance", (req, res) =>
    upstream(CAPPO(), "CAPPO_BACKEND_URL", "/api/uacp/governance", "GET", null, res));

  app.get("/api/uacp/roadmap", (req, res) =>
    upstream(CAPPO(), "CAPPO_BACKEND_URL", "/api/uacp/roadmap", "GET", null, res));

  app.get("/api/uacp/hub/metrics", (req, res) =>
    upstream(CAPPO(), "CAPPO_BACKEND_URL", "/api/uacp/hub/metrics", "GET", null, res));

  app.get("/api/uacp/hub/ssrn", (req, res) =>
    upstream(CAPPO(), "CAPPO_BACKEND_URL", "/api/uacp/hub/ssrn", "GET", null, res));

  app.get("/api/uacp/hub/observability", (req, res) =>
    upstream(CAPPO(), "CAPPO_BACKEND_URL", "/api/uacp/hub/observability", "GET", null, res));

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
