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

  try {
    await mcpClient.connect(transport);
    console.log("Connected to MCP Server: quantum-uacp-server");
  } catch (err) {
    console.error("Failed to connect to MCP Server", err);
  }

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

  // BYOS AI Backend Stubs
  const BYOS_STATE = {
    status: "healthy",
    llm_ok: true,
    circuit_breaker: { state: "CLOSED", failures: 0 },
    budget: { monthly: 100.00, current: 34.21 },
    security: { score: 94, events_open: 3 },
    privacy: { pii_protection: "active" },
    vibration_profile: {
      fft_mode: "harmonic_search",
      iso_standard: "10816",
      spectral_density: "stable"
    }
  };

  app.get("/api/status", (req, res) => {
    res.json({
      ...BYOS_STATE,
      llm_model: "Olmo3-Hybrid (State-Propagated)",
      uptime_seconds: Math.floor(process.uptime())
    });
  });

  app.get("/api/v1/monitoring/health", (req, res) => {
    res.json({
      status: "healthy",
      score: 98,
      components: {
        database: { status: "healthy", latency: "2ms" },
        redis: { status: "healthy", latency: "1ms" },
        ollama: { status: "healthy", latency: "45ms" }
      }
    });
  });

  app.get("/api/v1/security/stats", (req, res) => {
    res.json(BYOS_STATE.security);
  });

  app.post("/api/v1/privacy/detect-pii", (req, res) => {
    const { text } = req.body;
    const hasPII = /[\w\.-]+@[\w\.-]+\.\w+/.test(text || ""); // Simple email regex stub
    res.json({ has_pii: hasPII, types: hasPII ? ["email"] : [] });
  });

  app.post("/v1/exec", async (req, res) => {
    const { prompt, model } = req.body;
    // Mocking an AI response for the BYOS Engine
    res.json({
      response: `[BYOS ${model || "qwen2.5:3b"}] Processed: ${prompt?.substring(0, 50)}...`,
      provider: "ollama",
      model: model || "qwen2.5:3b",
      latency_ms: 1200,
      log_id: `exec_${Math.random().toString(36).substring(7)}`
    });
  });

  app.post("/api/v1/auth/register", (req, res) => {
    res.json({ access_token: "mock_jwt_token", workspace_id: "work_123" });
  });

  app.post("/api/v1/cost/predict", (req, res) => {
    res.json({ predicted_cost: "0.00124", alternatives: [{ provider: "ollama", cost: "0.0" }] });
  });

  app.post("/api/v1/content-safety/scan", (req, res) => {
    res.json({ allowed: true, category: "safe", confidence: 0.99 });
  });

  app.get("/api/climate/emissions", (req, res) => {
    res.json([
        { year: 1990, value: 22.4, label: "Baseline" },
        { year: 2000, value: 25.2 },
        { year: 2010, value: 33.1 },
        { year: 2020, value: 34.8, label: "Pandemic Dip" },
        { year: 2024, value: 37.8, label: "Record High" },
        { year: 2025, value: 38.1, label: "Projected" }
    ]);
  });

  app.get("/api/climate/regional", (req, res) => {
    res.json([
        { name: "China", volume: 16000, percentage: 30, perCapita: 11.3 },
        { name: "USA", volume: 5970, percentage: 11, perCapita: 18.0 },
        { name: "India", volume: 4140, percentage: 8, perCapita: 2.9 },
        { name: "EU-27", volume: 3230, percentage: 6, perCapita: 7.2 },
        { name: "Russia", volume: 2660, percentage: 5, perCapita: 18.3 },
        { name: "Brazil", volume: 1300, percentage: 2, perCapita: 6.1 }
    ]);
  });

  // PGL Framework: Project Genome Ledger
  const generateGenomeHash = (layers: any) => {
    const seed = JSON.stringify(layers);
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        const char = seed.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  };

  const CURRENT_GENOME_LAYERS = {
    model: "Olmo3-Hybrid-v3.1",
    prompt: "PGL-Constitutional-v1",
    policy: "Article-12-Compliant",
    watchtower: "Active-MELT-Guard",
    task_profile: "Industrial-Predictive-Main"
  };

  const GENOME_HASH = generateGenomeHash(CURRENT_GENOME_LAYERS);

  app.get("/api/pgl/genome", (req, res) => {
    res.json({
        hash: GENOME_HASH,
        layers: CURRENT_GENOME_LAYERS,
        timestamp: new Date().toISOString()
    });
  });

  app.get("/api/pgl/ledger", (req, res) => {
    res.json([
        { id: "g-001", type: "genome", label: "Root Genome", relation: "DERIVED_FROM" },
        { id: "g-v2", type: "genome", label: "Hybrid Expansion", parentId: "g-001", relation: "DERIVED_FROM" },
        { id: `g-${GENOME_HASH.substring(0, 4)}`, type: "genome", label: `Current DNA (${GENOME_HASH.substring(0, 8)})`, parentId: "g-v2", relation: "DERIVED_FROM" },
        { id: "out-442", type: "output", label: "Inference-Trace-442", parentId: `g-${GENOME_HASH.substring(0, 4)}`, relation: "PRODUCED_BY" }
    ]);
  });

  app.get("/api/seked/status", (req, res) => {
    const e = Math.random();
    const r = Math.random();
    const c = Math.random();
    const d = Math.random();
    const s = Math.random();
    
    // Deterministic Logic: Map multi-dimensional space to 9 directives
    const calculateSekedDirective = (e: number, r: number, c: number, d: number, s: number): string => {
        // Treat each parameter as having 10 discrete levels (0-9)
        const eL = Math.floor(e * 10);
        const rL = Math.floor(r * 10);
        const cL = Math.floor(c * 10);
        const dL = Math.floor(d * 10);
        const sL = Math.floor(s * 10);

        // Compute a state index from 0 to 99999
        const stateIndex = eL + rL * 10 + cL * 100 + dL * 1000 + sL * 10000;
        
        // Map 100k states to 9 directives using a prime-multiplication hash for better distribution
        const prime = 99991; 
        const mappedIndex = (stateIndex * prime) % 9;
        
        const directives = ["HALT", "WAIT", "STABILIZE", "GRIND", "CLARIFY", "FORTIFY", "EXECUTE", "EXPAND", "SCALE BACK"];
        return directives[Math.abs(mappedIndex)];
    }
    
    const directive = calculateSekedDirective(e, r, c, d, s);

    res.json({
        energy: e,
        resilience: r,
        confidence: c,
        diversity: d,
        stability: s,
        directive: directive
    });
  });

  app.get("/api/uacp/layers", (req, res) => {
    res.json([
        { layer: 'cognitive', status: 'active', latency: 420 },
        { layer: 'context', status: 'active', latency: 85 },
        { layer: 'execution', status: 'isolated', latency: 125 },
        { layer: 'hitl', status: 'idempotent', latency: 0 }
    ]);
  });

  app.get("/api/uacp/bounded", (req, res) => {
    res.json({
        phi_ratio: 1.618,
        carbon_intensity: 0.24,
        utilization: 0.88,
        water_risk: 'low'
    });
  });

  app.get("/api/uacp/security", (req, res) => {
    res.json({
        surfaces: [
            { name: "Tool Poisoning", threat_level: "critical", containment: 0.92, description: "Schema validation & description version pinning" },
            { name: "Rug Pull", threat_level: "high", containment: 0.88, description: "Immutable tool registry & hash verification" },
            { name: "EchoLeak (CVE-2025-32711)", threat_level: "critical", containment: 0.99, description: "Markdown sanitization & egress allowlisting" },
            { name: "Indirect Injection", threat_level: "medium", containment: 0.75, description: "Content source tagging & spotlighting" },
            { name: "Shadow Servers", threat_level: "high", containment: 0.85, description: "Attestation-based authentication & scoped delegation" },
            { name: "Cross-Server Shadowing", threat_level: "medium", containment: 0.90, description: "Architectural isolation via context partitioning" },
            { name: "Path Traversal", threat_level: "low", containment: 0.99, description: "Hardware-isolated MicroVM sandboxing" }
        ],
        gateway: {
            sanitization: 'active',
            redaction: 'active',
            auditing: 'active',
            egress_control: 'active',
            last_scan_result: 'clear'
        }
    });
  });

  app.get("/api/uacp/governance", (req, res) => {
    res.json({
        xaa_status: 'enforced',
        jit_access: 'active',
        secretless_mode: true,
        active_agents: 12,
        shadow_ai_detected: 0
    });
  });

  app.get("/api/uacp/roadmap", (req, res) => {
    res.json([
        { id: 1, label: "Discovery", status: "completed", description: "Inventory all active agents and MCP servers.", target_threat: "Shadow AI Access" },
        { id: 2, label: "Policy", status: "completed", description: "Establish Agency Governance & OWASP alignments.", target_threat: "Excessive Agency" },
        { id: 3, label: "Identity", status: "in-progress", description: "Transition to Ephemeral JIT Scoped Credentials.", target_threat: "Lateral Movement" },
        { id: 4, label: "Defense", status: "planned", description: "Architect Zero-Trust MCP Gateway Proxy.", target_threat: "Protocol Exploitation" },
        { id: 5, label: "Regulatory", status: "planned", description: "Full EU AI Act Alignment & Article-14 HITL Gates.", target_threat: "Compliance Liabilities" }
    ]);
  });

  app.get("/api/uacp/hub/metrics", (req, res) => {
    res.json({
        determinism_ratio: 3.0,
        certainty_index: 0.9999,
        acceptable_noise: 0.05,
        deterministic_entropy: 0.012,
        latency: 12.8,
        coherence: 89.2,
        operational_plane_locked: true,
        active_agents_consensus: 10,
        gopher_policy_status: 'ACTIVE',
        system_progress: 0.0000001
    });
  });

  app.get("/api/uacp/hub/ssrn", (req, res) => {
    res.json([
        { node: "Memory Dynamics (Historical Heuristics)", match_strength: 92.41 },
        { node: "Proximal Projection for Doubly Sparse Regularized Models", match_strength: 97.77 },
        { node: "Boosting Team Modeling (Tempo-Relational)", match_strength: 94.73 },
        { node: "Sequential vs. Simultaneous Entanglement Swapping", match_strength: 91.86 },
        { node: "Ergotropy Protection via Cavity Detuning", match_strength: 90.01 },
        { node: "Catastrophe-dispersion models in varying environments", match_strength: 89.46 },
        { node: "Human-computer interactions predict mental health", match_strength: 88.77 },
        { node: "FTPrimitiveBench: Logical Computation Suite", match_strength: 87.88 }
    ]);
  });

  app.get("/api/uacp/hub/observability", (req, res) => {
    res.json([
        { name: "UACP_PRESSURE", state: "RISING", value: 0.82 },
        { name: "COHERENCE_TRANSITION", state: "STABLE", value: 0.95 },
        { name: "SIGNAL_NOISE", state: "FALLING", value: 0.04 }
    ]);
  });

  app.post("/api/pgl/commit", (req, res) => {
    res.json({ 
        status: "success", 
        certificate_id: `cert-${Math.random().toString(36).substring(7)}`,
        message: "Constitutional Write Committed. Ed25519 Birth Certificate Issued."
    });
  });

  app.get("/api/pgl/spdx", (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json({
        spdxVersion: "SPDX-3.0.1",
        profile: "AI",
        genome_hash: GENOME_HASH,
        compliance: "Article-12-Verified"
    });
  });

  app.get("/api/pgl/cyclonedx", (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json({
        bomFormat: "CycloneDX",
        specVersion: "1.7",
        model_layers: CURRENT_GENOME_LAYERS,
        governance_overhead: "420μs"
    });
  });

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
