import React, { useState, useEffect, useRef } from 'react';
import './index.css';
import { SpectralAnalysis } from './components/SpectralAnalysis';
import { GovernanceMonitor } from './components/GovernanceMonitor';
import { ComplianceHorizon } from './components/ComplianceHorizon';
import { GenomeDNA } from './components/GenomeDNA';
import { LineageLedger } from './components/LineageLedger';
import { StatePropagationAtlas } from './components/StatePropagationAtlas';
import { ROIPanel } from './components/ROIPanel';
import { MCPStatusIndicator } from './components/MCPStatusIndicator';

// New imports
import { BoundedScaling } from './components/BoundedScaling';
import { UACPLayers } from './components/UACPLayers';
import { SEKEDCompiler } from './components/SEKEDCompiler';
import { AgentConsensusMatrix } from './components/AgentConsensusMatrix';
import { ArchivesOfOrder } from './components/ArchivesOfOrder';
import { DeterminismRatio } from './components/DeterminismRatio';
import { EmissionsTrajectory } from './components/EmissionsTrajectory';
import { GovernanceRoadmap } from './components/GovernanceRoadmap';
import { IdentityGovernancePanel } from './components/IdentityGovernancePanel';
import { IntentConsole } from './components/IntentConsole';
import { MCPGateway } from './components/MCPGateway';
import { MemoryVault } from './components/MemoryVault';
import { MitigationPathwaysPanel } from './components/MitigationPathwaysPanel';
import { ObservabilitySignals } from './components/ObservabilitySignals';
import { PolicyEvaluationPanel } from './components/PolicyEvaluationPanel';
import { ProbabilityMatrix } from './components/ProbabilityMatrix';
import { RegionalEmittersPanel } from './components/RegionalEmittersPanel';
import { SignalIngestionFeed } from './components/SignalIngestionFeed';
import { ThreatLandscape } from './components/ThreatLandscape';
import { LLMProvider, ProviderConfig } from './types';

// Type definitions to help manage the state
type ViewType = 'terminal' | 'mesh' | 'tele' | 'paths' | 'engine' | 'hub' | 'climate' | 'security';
type LogType = 'sys' | 'pmt' | 'out' | 'ok' | 'warn' | 'err' | 'dim' | 'pur' | 'hdr' | 'sep' | 'custom';

interface SpecPath {
  l: string;
  v: number;
  locked?: boolean;
  pruned?: boolean;
  ok?: boolean; // custom logical state for color
}

interface LogEntry {
  id: string;
  text: string;
  type: LogType;
  delay?: number;
  isSpec?: boolean;
  specPaths?: SpecPath[];
  isMesh?: boolean;
  meshLbl?: string;
  isRaw?: boolean;
}

interface TelemetryState {
  zenoCycles: number;
  pathsPruned: number;
  eventLogs: { id: string; cls: string; text: string; time: string }[];
}

function ZenoCanvas({ zenoOn, zenoLabel }: { zenoOn: boolean; zenoLabel: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    let animationId: number;
    let zenoPhase = 0;

    const resizeZ = () => {
      const d = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * d;
      canvas.height = 26 * d;
      ctx.scale(d, d);
    };
    resizeZ();
    window.addEventListener('resize', resizeZ);

    const drawZ = () => {
      const w = canvas.offsetWidth;
      const h = 26;
      ctx.clearRect(0, 0, w * 2, h * 2);
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const amp = zenoOn ? 7 : 2.5;
        const fr = zenoOn ? 0.07 : 0.035;
        const y = h / 2 + Math.sin(x * fr + zenoPhase) * amp + Math.sin(x * fr * 2.1 + zenoPhase * 1.6) * (amp * 0.35);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = zenoOn ? 'rgba(227,179,65,.75)' : 'rgba(99,179,237,.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      
      if (zenoOn) {
        for (let i = 0; i < 5; i++) {
          const sx = (canvas.offsetWidth / 6) * (i + 1) + Math.sin(zenoPhase + i) * 4;
          const sh = 6 + Math.abs(Math.sin(zenoPhase * 2 + i)) * 9;
          ctx.beginPath();
          ctx.moveTo(sx, h / 2);
          ctx.lineTo(sx, h / 2 - sh);
          ctx.strokeStyle = `rgba(188,140,255,${0.3 + Math.abs(Math.sin(zenoPhase + i)) * 0.5})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
      zenoPhase += zenoOn ? 0.055 : 0.016;
      animationId = requestAnimationFrame(drawZ);
    };
    drawZ();

    return () => {
      window.removeEventListener('resize', resizeZ);
      cancelAnimationFrame(animationId);
    };
  }, [zenoOn]);

  return (
    <div className="zeno-strip">
      <div className="z-lbl">Zeno</div>
      <div className="z-wrap"><canvas ref={canvasRef} id="zeno"></canvas></div>
      <div className={`z-state ${zenoOn ? 'on' : ''}`}>{zenoLabel}</div>
    </div>
  );
}

const PROVIDERS: ProviderConfig[] = [
  { id: 'google', name: 'Google Gemini', enabled: true },
  { id: 'openai', name: 'OpenAI GPT-4o', enabled: true },
  { id: 'anthropic', name: 'Anthropic Claude', enabled: true },
  { id: 'groq', name: 'Groq LPU', enabled: true },
  { id: 'deepseek', name: 'DeepSeek', enabled: true },
];

export default function App() {
  const [activeView, setActiveView] = useState<ViewType>('terminal');
  const [inputVal, setInputVal] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [zenoState, setZenoState] = useState({ on: false, lbl: 'PHASE_LOCKED' });
  const [selectedProvider, setSelectedProvider] = useState<string>('google');
  const [agentTaskForce, setAgentTaskForce] = useState(() => 
    Array.from({ length: 100 }).map((_, i) => ({
      id: i + 1,
      role: `Agent-${i + 1}`,
      status: 'idle' as 'idle' | 'assigned' | 'executing' | 'blocked'
    }))
  );

  // Hub / Strategic Intent Console state
  const [hubProvider, setHubProvider] = useState<LLMProvider>('google');
  const [hubOutput, setHubOutput] = useState<any>(null);
  const [hubLoading, setHubLoading] = useState(false);
  
  const [tele, setTele] = useState<TelemetryState>({
    zenoCycles: 0,
    pathsPruned: 0,
    eventLogs: [
      { id: '1', cls: 'g', text: '<b>BOOT</b> — All 3 context servers initialised', time: '00:00' },
      { id: '2', cls: 'p', text: '<b>Zeno</b> — Interrogator subsystem ONLINE', time: '00:01' },
      { id: '3', cls: 'a', text: '<b>co2router_srv</b> — Capability negotiation pending', time: '00:01' }
    ]
  });

  const [evTimeOffset, setEvTimeOffset] = useState(2);
  const outRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (outRef.current) {
      outRef.current.scrollTop = outRef.current.scrollHeight;
    }
  }, [logs, isTyping]);

  useEffect(() => {
    let isMounted = true;
    const safePushLog = (text: string, type: LogType) => {
      if (isMounted) pushLog(text, type);
    };
    const bootSequence = async () => {
      await sleep(100);
      safePushLog('—'.repeat(44), 'sep');
      safePushLog('  VEKLOM TERMINAL  //  UACP v4.0', 'hdr');
      safePushLog('  Neural Orchestration Engine · Antigravity v4.0', 'dim');
      safePushLog('—'.repeat(44), 'sep');
      await sleep(200); safePushLog('[BOOT]  Quantum context surface…', 'sys');
      await sleep(200); safePushLog('[BOOT]  MCP host adapter loaded', 'sys');
      await sleep(200); safePushLog('        ✓  filesystem_srv  (stdio)', 'ok');
      await sleep(200); safePushLog('        ✓  quantum_srv     (SSE, 1024 qubits)', 'ok');
      await sleep(200); safePushLog('        ⚠  co2router_srv   (capability pending)', 'warn');
      await sleep(200); safePushLog('[BOOT]  Zeno Interrogator: ONLINE', 'sys');
      await sleep(200); safePushLog('[BOOT]  Gladiator Engine: 8 paths ready', 'sys');
      await sleep(200); safePushLog('[BOOT]  Cognitive Engine: CONNECTED', 'ok');
      await sleep(150); safePushLog('', 'out');
      await sleep(150); safePushLog('Tap a chip or type a command. Explore all 5 tabs below.', 'dim');
      await sleep(150); safePushLog('—'.repeat(44), 'sep');
    };
    bootSequence();
    return () => { isMounted = false; };
  }, []);

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const pushLog = (text: string, type: LogType, extra: Partial<LogEntry> = {}) => {
    setLogs(p => [...p, { id: crypto.randomUUID(), text, type, ...extra }]);
  };

  const updateTele = (z: number, p: number) => {
    setTele(prev => ({
      ...prev,
      zenoCycles: prev.zenoCycles + z,
      pathsPruned: prev.pathsPruned + p
    }));
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setTele(prev => ({
        ...prev,
        zenoCycles: prev.zenoCycles + Math.floor(Math.random() * 3)
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const addEvent = (cls: string, text: string) => {
    setTele(prev => {
      const newTime = evTimeOffset + Math.floor(Math.random() * 4) + 1;
      setEvTimeOffset(newTime);
      const m = String(Math.floor(newTime / 60)).padStart(2, '0');
      const s = String(newTime % 60).padStart(2, '0');
      const t = `${m}:${s}`;
      return {
        ...prev,
        eventLogs: [{ id: crypto.randomUUID(), cls, text, time: t }, ...prev.eventLogs]
      };
    });
  };

  const submitCmd = async () => {
    const raw = inputVal.trim();
    if (!raw) return;
    setInputVal('');
    
    pushLog('', 'out');
    pushLog(`$ ${raw}`, 'pmt');
    
    setIsTyping(true);
    setZenoState({ on: true, lbl: 'INTERROGATING' });
    
    const aInterval = setInterval(() => {
      setAgentTaskForce(p => p.map(a => Math.random() > 0.82 ? { ...a, status: ['assigned', 'executing', 'blocked', 'idle'][Math.floor(Math.random() * 4)] as any } : a));
    }, 150);

    try {
      await sleep(650);
      setIsTyping(false);
      
      // Slash commands take priority over everything
      if (raw.startsWith('/')) {
        await handleSlashCommand(raw);
      } else {
        // Natural language chip prompts — keyword matched demos
        const lo = raw.toLowerCase();
        if (lo.includes('bitmap') || lo.includes('transmiss')) await doBitmap();
        else if (lo.includes('heron') || lo.includes('qubit') || lo.includes('calibrat')) await doQuantum();
        else if (lo.includes('co2')) await doCO2();
        else if (lo.includes('zeno') || lo.includes('interrogat')) await doZeno();
        else if (lo.includes('mcp') || lo.includes('mesh') || lo.includes('topolog')) await doMCP();
        else await doUnknown(raw);
      }
    } finally {
      clearInterval(aInterval);
      setAgentTaskForce(p => p.map(a => ({ ...a, status: 'idle' })));
      setZenoState({ on: false, lbl: 'PHASE_LOCKED' });
    }
  };

  const doBitmap = async () => {
    pushLog('[ENGINE]  Bitmap transmission analysis', 'sys');
    await sleep(200); pushLog('[MCP]     Routing → quantum_srv', 'sys');
    pushLog('', 'custom', { isMesh: true, meshLbl: 'tools/compress' });
    await sleep(350); pushLog('[ZENO]    128-cycle interrogation', 'pur');
    updateTele(128, 0); addEvent('p', '<b>Zeno</b> — 128-cycle bitmap scan complete');
    await sleep(500); pushLog('[GLADIATOR]  Speculative paths:', 'sys');
    pushLog('', 'custom', { isSpec: true, specPaths: [{l:'RLE-Delta',v:87,locked:true,ok:true},{l:'Huffman+Q',v:74,locked:true,ok:true},{l:'LDPC-QEC',v:61,locked:true,ok:true},{l:'Raw-LZ4',v:22,pruned:true},{l:'Naive-RLE',v:9,pruned:true}] });
    await sleep(1300); pushLog('', 'out');
    await sleep(100); pushLog('[RESULT]  RLE-Delta + Huffman hybrid', 'ok');
    await sleep(150); pushLog('          10,000 bits → 1,247 bits  (87.5% reduction)', 'out');
    await sleep(150); pushLog('          Latency: 0.38ms @ 1Gbps', 'out');
    updateTele(0, 2); addEvent('g', '<b>Bitmap</b> — Orchestration complete, 2 paths pruned');
    await sleep(200); pushLog('[OK]      Orchestration complete.', 'ok');
  };

  const doQuantum = async () => {
    pushLog('[ENGINE]  1000-qubit Heron calibration', 'sys');
    await sleep(200); pushLog('[MCP]     Session → quantum_srv (SSE)', 'sys');
    pushLog('', 'custom', { isMesh: true, meshLbl: 'tools/calibrate' });
    await sleep(400); pushLog('[ZENO]    256-cycle non-local interrogation', 'pur');
    updateTele(256, 0); addEvent('p', '<b>Zeno</b> — 256-cycle QPU scan, 4 qubit collapses detected');
    await sleep(200); pushLog('[ZENO]    Collapse on qubits: 17, 203, 441, 889', 'warn');
    await sleep(200); pushLog('[GLADIATOR]  Calibration strategies:', 'sys');
    pushLog('', 'custom', { isSpec: true, specPaths: [{l:'Echoed CR',v:91,locked:true},{l:'ZNE mitigat',v:78,locked:true},{l:'Rand bench',v:66,locked:true},{l:'Clifford',v:44},{l:'Naive reset',v:11,pruned:true}] });
    await sleep(1400); pushLog('', 'out');
    await sleep(100); pushLog('[RESULT]  Echoed CR + ZNE mitigation', 'ok');
    await sleep(150); pushLog('          F₂q = 0.9974  ·  T1 = 142μs (+18%)', 'out');
    updateTele(0, 1); addEvent('g', '<b>Heron</b> — QPU calibrated, F₂q=0.9974');
    await sleep(200); pushLog('[OK]      Heron QPU calibrated.', 'ok');
  };

  const doCO2 = async () => {
    pushLog('[ENGINE]  CO2 Router MCP synthesis', 'sys');
    await sleep(200); pushLog('[MCP]     Negotiating co2router_srv…', 'warn');
    await sleep(400); pushLog('[MCP]     ✓ 35 APIs registered', 'ok');
    pushLog('', 'custom', { isMesh: true, meshLbl: 'resources/metrics' });
    await sleep(350); pushLog('[ZENO]    64-cycle emissions scan', 'pur');
    updateTele(64, 0); addEvent('a', '<b>co2router_srv</b> — Capability negotiation complete');
    await sleep(500); pushLog('[GLADIATOR]  Orchestration paths:', 'sys');
    pushLog('', 'custom', { isSpec: true, specPaths: [{l:'Passive mon',v:93,locked:true},{l:'Active route',v:80,locked:true},{l:'Load-balance',v:67,locked:true},{l:'Full offload',v:33,pruned:true}] });
    await sleep(1100); pushLog('', 'out');
    await sleep(100); pushLog('[RESULT]  Passive telemetry + dynamic rerouting', 'ok');
    await sleep(150); pushLog('          2.4 → 1.1 kg CO₂e/hr  (54% reduction)', 'out');
    await sleep(150); pushLog('          Income path: metered API → Veklom marketplace', 'ok');
    updateTele(0, 1); addEvent('g', '<b>CO2 Router</b> — 54% emissions reduction plan locked');
    await sleep(200); pushLog('[OK]      co2router_srv session committed.', 'ok');
  };

  const doZeno = async () => {
    pushLog('[ENGINE]  Zeno Interrogation protocol', 'sys');
    await sleep(200); pushLog('[ZENO]    Target: filesystem_srv', 'pur');
    await sleep(180); pushLog('[ZENO]    Measurement freq: ω = 512 Hz', 'pur');
    updateTele(512, 0); addEvent('p', '<b>Zeno</b> — 512-cycle filesystem scan initiated');
    const states = ['COHERENT', 'SUPERPOSED', 'ENTANGLED', 'COHERENT', 'PHASE_LOCKED'];
    for(let i=0; i<5; i++) {
        await sleep(200);
        pushLog(`[ZENO]    Cycle ${(i+1)*100}/512  →  ${states[i]}`, 'dim');
    }
    await sleep(200); pushLog('', 'out');
    await sleep(100); pushLog('[RESULT]  Zeno Effect confirmed — system frozen 847ms', 'ok');
    await sleep(150); pushLog('          14 resources extracted, 0 actual reads', 'out');
    addEvent('g', '<b>Zeno</b> — Interaction-free measurement complete');
    await sleep(200); pushLog('[OK]      System undisturbed.', 'ok');
  };

  const doMCP = async () => {
    pushLog('[ENGINE]  MCP mesh topology synthesis', 'sys');
    pushLog('', 'custom', { isMesh: true, meshLbl: 'initialize' });
    await sleep(300); pushLog('[MCP]     initialize (protocol v2025-03-26)', 'sys');
    await sleep(250); pushLog('[MCP]     {tools:12, resources:8, prompts:4}', 'out');
    await sleep(250); pushLog('[MCP]     1:1 sessions on 3 context servers', 'ok');
    await sleep(200); pushLog('[GLADIATOR]  Path evaluation:', 'sys');
    pushLog('', 'custom', { isSpec: true, specPaths: [{l:'Adaptive',v:95,locked:true},{l:'Parallel fan',v:88,locked:true},{l:'Sequential',v:72,locked:true},{l:'Batch all',v:30,pruned:true}] });
    addEvent('g', '<b>MCP</b> — Mesh fully operational, 3 servers active');
    await sleep(1700); pushLog('', 'out');
    await sleep(100); pushLog('[RESULT]  Adaptive orchestration locked', 'ok');
    await sleep(150); pushLog('[OK]      USB-C moment achieved.', 'ok');
  };

  const doUnknown = async (raw: string) => {
    const trunc = raw.length > 60 ? raw.slice(0, 60) + '…' : raw;
    await sleep(100);
    pushLog(`[UACP]    Unknown command: ${trunc}`, 'warn');
    pushLog('[UACP]    Type \'help\' or \'/help\' to see available commands.', 'dim');
  };

  const doVendorScout = async (args: string) => {
    const sub = args.trim().toLowerCase();
    if (!sub || sub === 'status') {
      pushLog('[AGENT]   Vendor Scout module: checking connection…', 'sys');
      await sleep(300);
      pushLog('[AGENT]   Browser/search agent: NOT CONNECTED', 'warn');
      pushLog('[AGENT]   To enable: wire the browser agent and restart the orchestration plane.', 'dim');
    } else if (sub.startsWith('find')) {
      const query = args.replace(/^find\s*/i, '').trim();
      pushLog(`[AGENT]   Vendor scout find: "${query || '(no query)'}"`, 'sys');
      await sleep(300);
      pushLog('[AGENT]   Vendor scout agent not connected yet.', 'warn');
      pushLog('[AGENT]   No fake leads will be generated. Connect the browser agent first.', 'dim');
    } else if (sub === 'leads') {
      pushLog('[AGENT]   Vendor lead cache: EMPTY', 'warn');
      pushLog('[AGENT]   No leads available. Browser agent not connected.', 'dim');
    } else if (sub === 'export') {
      pushLog('[AGENT]   Export: no data to export. Run /vendor-scout find <query> first.', 'warn');
    } else if (sub === 'contact-approved') {
      pushLog('[AGENT]   Contact-approved list: EMPTY', 'warn');
      pushLog('[AGENT]   No approved contacts. Founder approval required before any outreach.', 'dim');
    } else {
      pushLog(`[AGENT]   Unknown vendor-scout subcommand: ${sub}`, 'warn');
      pushLog('[AGENT]   Usage: /vendor-scout status | find <query> | leads | export | contact-approved', 'dim');
    }
  };

  const doHelp = async () => {
    await sleep(80);
    pushLog('━━━━ UACP OPERATOR TERMINAL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'hdr');
    pushLog('', 'out');
    pushLog('  SYSTEM', 'sep');
    pushLog('  /help                    Show this help', 'out');
    pushLog('  /clear                   Clear terminal output', 'out');
    pushLog('', 'out');
    pushLog('  MCP DEMO', 'sep');
    pushLog('  /mcp-demo                Run MCP mesh topology demo', 'out');
    pushLog('  /mcp-mesh                Alias for /mcp-demo', 'out');
    pushLog('  /mesh-test               Run mesh connectivity test', 'out');
    pushLog('', 'out');
    pushLog('  VENDOR SCOUT', 'sep');
    pushLog('  /vendor-scout status     Check browser/search agent status', 'out');
    pushLog('  /vendor-scout find <q>   Search for vendors (requires agent)', 'out');
    pushLog('  /vendor-scout leads      Show cached lead list', 'out');
    pushLog('  /vendor-scout export     Export lead data', 'out');
    pushLog('  /vendor-scout contact-approved  List approved contacts', 'out');
    pushLog('', 'out');
    pushLog('  GOVERNANCE', 'sep');
    pushLog('  Hub tab → Strategic Intent Console → dispatch an intent', 'out');
    pushLog('  Governance tab → policy evaluation and compliance horizon', 'out');
    pushLog('', 'out');
    pushLog('  TELEMETRY (READ-ONLY)', 'sep');
    pushLog('  Telemetry tab → live signal feed and KPI dashboard', 'out');
    pushLog('  MCP tab → mesh topology and server health', 'out');
    pushLog('', 'out');
    pushLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'dim');
  };

  const handleSlashCommand = async (raw: string) => {
    const parts = raw.slice(1).trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const rest = parts.slice(1).join(' ');

    if (cmd === 'help') {
      await doHelp();
    } else if (cmd === 'clear') {
      setLogs([]);
      pushLog('[UACP]    Terminal cleared.', 'dim');
    } else if (cmd === 'mcp-demo' || cmd === 'mcp-mesh' || cmd === 'mesh-test') {
      await doMCP();
    } else if (cmd === 'vendor-scout') {
      await doVendorScout(rest);
    } else {
      pushLog(`[UACP]    Unknown command: /${cmd}`, 'warn');
      pushLog('[UACP]    Type \'/help\' to see available commands.', 'dim');
    }
  };

  const handleHubExecute = async (intent: string) => {
    if (!intent.trim()) return;
    setHubLoading(true);
    setHubOutput(null);
    try {
      const res = await fetch('/api/cognitive/orchestrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'operator',
          'x-agent-confidence': '1.0',
          'x-user-credits': '9999',
        },
        body: JSON.stringify({
          prompt: intent,
          context: {
            source: 'operator_terminal',
            view: 'hub',
            timestamp: new Date().toISOString(),
          },
          provider: hubProvider,
          model: hubProvider === 'google' ? 'gemini-2.0-flash-exp' : undefined,
        }),
      });
      const data = await res.json();
      setHubOutput(data);
    } catch (err: any) {
      setHubOutput({ error: true, message: err.message || 'Network error — check server logs.' });
    } finally {
      setHubLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') submitCmd();
  };

  const fillPrompt = (t: string) => {
    setInputVal(t);
    setActiveView('terminal');
    // We let the user press run
  };

  const pct = Math.min((tele.zenoCycles/512)*100, 100).toFixed(0);
  const coh = (99.8 - tele.pathsPruned*0.3).toFixed(1);

  return (
    <div className="shell">
      <div className="scanline-fx"></div>
      {/* Titlebar */}
      <div className="titlebar">
        <div className="tb-inner">
          <div className="tb-l">
            <div className="dots"><div className="dot r"></div><div className="dot a"></div><div className="dot g"></div></div>
            <div className="tb-title"><b>VEKLOM TERMINAL</b> · UACP v4.0</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MCPStatusIndicator />
            <div className="tb-stat"><div className="live-dot"></div>LIVE</div>
          </div>
        </div>
      </div>

      <ZenoCanvas zenoOn={zenoState.on} zenoLabel={zenoState.lbl} />

      {/* VIEWS */}
      <div className="views">
        
        {/* Terminal View */}
        <div className={`view ${activeView === 'terminal' ? 'active' : ''}`} id="v-terminal">
          <div className="chips-bar">
            <div className="chip" onClick={() => fillPrompt('Optimize a 10,000-bit monochrome bitmap transmission')}>📡 Bitmap tx</div>
            <div className="chip" onClick={() => fillPrompt('Calibrate a thousand-qubit Heron processor')}>⚛️ Heron QPU</div>
            <div className="chip" onClick={() => fillPrompt('Synthesize MCP orchestration plan for CO2 Router')}>🌿 CO2 Router</div>
            <div className="chip" onClick={() => fillPrompt('Run Zeno interrogation on filesystem_srv')}>🔬 Zeno scan</div>
            <div className="chip" onClick={() => fillPrompt('Show MCP mesh topology')}>🕸️ MCP mesh</div>
          </div>
          
          <div className="output" id="output" ref={outRef}>
            {logs.map((L) => {
              if (L.type === 'custom') {
                if (L.isSpec && L.specPaths) {
                  return (
                    <div key={L.id} className="spec-card">
                      {L.specPaths.map((p, i) => (
                        <div key={i} className={`path ${p.pruned ? 'pruned' : ''} ${p.locked ? 'locked' : ''}`}>
                          <span className="p-lbl">{p.l}</span>
                          <div className="p-bar">
                            <div className={`p-fill ${p.ok ? 'ok' : ''}`} style={{ width: `${p.v}%` }}></div>
                          </div>
                          <span className="p-pct">{p.v}%</span>
                        </div>
                      ))}
                    </div>
                  );
                }
                if (L.isMesh) {
                  return (
                    <div key={L.id} className="spec-card">
                      <div style={{fontSize:'9px',color:'var(--text-f)',marginBottom:'8px',textTransform:'uppercase',letterSpacing:'.12em'}}>
                        MCP Session · {L.meshLbl || 'JSON-RPC'}
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:'0',overflowX:'auto'}}>
                        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'3px',minWidth:'72px'}}>
                          <div style={{padding:'5px 8px',borderRadius:'4px',border:'1px solid var(--border-b)',background:'var(--accent-dim)',color:'var(--accent)',fontSize:'9px'}}>UACP HOST</div>
                          <div style={{fontSize:'8px',color:'var(--text-f)'}}>PerplexTerm</div>
                        </div>
                        <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',minWidth:'32px'}}>
                          <div style={{fontSize:'8px',color:'var(--text-f)'}}>{L.meshLbl || 'JSON-RPC'}</div>
                          <div style={{width:'100%',height:'1px',background:'var(--border-b)'}}></div>
                        </div>
                        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'3px',minWidth:'72px'}}>
                          <div style={{padding:'5px 8px',borderRadius:'4px',border:'1px solid var(--border-b)',background:'var(--purple-dim)',color:'var(--purple)',fontSize:'9px'}}>MCP CLIENT</div>
                          <div style={{fontSize:'8px',color:'var(--text-f)'}}>Translator</div>
                        </div>
                        <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',minWidth:'32px'}}>
                          <div style={{fontSize:'8px',color:'var(--text-f)'}}>stdio/SSE</div>
                          <div style={{width:'100%',height:'1px',background:'var(--border-b)'}}></div>
                        </div>
                        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'3px',minWidth:'72px'}}>
                          <div style={{padding:'5px 8px',borderRadius:'4px',border:'1px solid var(--border-b)',background:'var(--green-dim)',color:'var(--green)',fontSize:'9px'}}>CTX SERVER</div>
                          <div style={{fontSize:'8px',color:'var(--text-f)'}}>quantum_srv</div>
                        </div>
                      </div>
                    </div>
                  );
                }
              }
              return <div key={L.id} className={`ln ${L.type}`}>{L.text}</div>;
            })}
          </div>

          <div className={`typing ${isTyping ? 'on' : ''}`} id="typing">
             <div className="td"></div><div className="td"></div><div className="td"></div>
             <div className="typing-lbl">Cognitive Engine…</div>
          </div>
          <div className="input-bar">
            <span className="i-pmt">$</span>
            <input 
              className="i-field" id="cmd" type="text" placeholder="Enter command…"
              value={inputVal} onChange={e => setInputVal(e.target.value)} onKeyDown={handleKeyDown}
              autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" enterKeyHint="send"
            />
            <button className="run-btn" onClick={submitCmd}>RUN</button>
          </div>
        </div>

        {/* Mesh View */}
        <div className={`view ${activeView === 'mesh' ? 'active' : ''}`} id="v-mesh">
          <div className="mesh-view">
             <div className="section-hdr">MCP Host–Client–Server Topology</div>
             <div className="topology">
                <div className="topo-node">
                  <div className="topo-box host">UACP HOST</div>
                  <div className="topo-lbl">Veklom Terminal</div>
                </div>
                <div className="topo-arrow"><div className="a-tag">JSON-RPC 2.0 · initialize</div><div className="a-line"></div></div>
                <div className="topo-node">
                  <div className="topo-box client">MCP CLIENT</div>
                  <div className="topo-lbl">Protocol Translator</div>
                </div>
                <div className="topo-arrow"><div className="a-tag">stdio / SSE transport</div><div className="a-line"></div></div>
                <div className="topo-node">
                  <div className="topo-box server">CONTEXT SERVERS</div>
                  <div className="topo-lbl">filesystem · quantum · co2router</div>
                </div>
             </div>

             <div className="section-hdr" style={{marginTop: '16px'}}>4-Step Protocol Handshake (I/O Riot NG)</div>
             <div className="kpi-grid" style={{marginBottom: '16px'}}>
               <div className="kpi-card"><div className="kpi-label">1. Capability Discovery</div><div className="kpi-val g">OK</div></div>
               <div className="kpi-card"><div className="kpi-label">2. Protocol Negotiation</div><div className="kpi-val g">OK</div></div>
               <div className="kpi-card"><div className="kpi-label">3. Session Initialization</div><div className="kpi-val g">OK</div></div>
               <div className="kpi-card"><div className="kpi-label">4. Transport Validation</div><div className="kpi-val g">OK</div></div>
             </div>

             <div className="section-hdr">Context Servers</div>
             <div className="srv-card">
                <div className="srv-head"><span className="srv-name">filesystem_srv</span><span className="srv-badge on">ACTIVE</span></div>
                <div className="srv-row"><span className="srv-k">Transport</span><span className="srv-v">stdio</span></div>
                <div className="srv-row"><span className="srv-k">Session</span><span className="srv-v g">Stateful 1:1</span></div>
                <div className="srv-row"><span className="srv-k">Protocol</span><span className="srv-v">v2025-03-26</span></div>
                <div className="srv-divider"></div>
                <div className="srv-k" style={{marginBottom:'6px'}}>Capabilities</div>
                <div className="cap-row">
                   <div className="cap-pill">tools × 6</div><div className="cap-pill">resources × 12</div><div className="cap-pill">prompts × 2</div>
                </div>
             </div>

             <div className="srv-card">
                <div className="srv-head"><span className="srv-name">quantum_srv</span><span className="srv-badge on">ACTIVE</span></div>
                <div className="srv-row"><span className="srv-k">Transport</span><span className="srv-v">SSE</span></div>
                <div className="srv-row"><span className="srv-k">Session</span><span className="srv-v g">Stateful 1:1</span></div>
                <div className="srv-row"><span className="srv-k">Qubits</span><span className="srv-v p">1,024 registered</span></div>
                <div className="srv-row"><span className="srv-k">Gate fidelity</span><span className="srv-v g">F₂q = 0.9974</span></div>
                <div className="srv-divider"></div>
                <div className="cap-row">
                   <div className="cap-pill">tools × 8</div><div className="cap-pill">resources × 4</div><div className="cap-pill">Zeno API</div><div className="cap-pill">QPU calibrate</div>
                </div>
             </div>

             <div className="srv-card">
                <div className="srv-head"><span className="srv-name">co2router_srv</span><span className="srv-badge warn">NEGOTIATING</span></div>
                <div className="srv-row"><span className="srv-k">Transport</span><span className="srv-v">SSE</span></div>
                <div className="srv-row"><span className="srv-k">APIs</span><span className="srv-v a">35 endpoints</span></div>
                <div className="srv-row"><span className="srv-k">Emissions baseline</span><span className="srv-v a">2.4 kg CO₂e/hr</span></div>
                <div className="srv-row"><span className="srv-k">Optimized target</span><span className="srv-v g">1.1 kg CO₂e/hr</span></div>
                <div className="srv-divider"></div>
                <div className="cap-row">
                   <div className="cap-pill">monitoring</div><div className="cap-pill">rerouting</div><div className="cap-pill">Veklom bridge</div>
                </div>
             </div>
          </div>
        </div>

        {/* Telemetry View */}
        <div className={`view ${activeView === 'tele' ? 'active' : ''}`} id="v-tele">
          <div className="tele-view">
             <div className="section-hdr">Live System Metrics</div>
             <div className="kpi-grid">
               <div className="kpi-card"><div className="kpi-label">Zeno Cycles</div><div className="kpi-val">{tele.zenoCycles}</div><div className="kpi-sub">Total interrogations</div></div>
               <div className="kpi-card"><div className="kpi-label">Coherence</div><div className="kpi-val g">{coh}%</div><div className="kpi-sub">Phase stability</div></div>
               <div className="kpi-card"><div className="kpi-label">Paths Pruned</div><div className="kpi-val a">{tele.pathsPruned}</div><div className="kpi-sub">Hallucinated branches</div></div>
               <div className="kpi-card"><div className="kpi-label">MCP Sessions</div><div className="kpi-val p">3</div><div className="kpi-sub">Active servers</div></div>
             </div>
             
             <div className="section-hdr">Resource Utilisation</div>
             <div className="tele-bar-card">
               <div className="tb-row"><span className="tb-key">Quantum context buffer</span><span className="tb-val">{pct}%</span></div>
               <div className="tb-bar"><div className="tb-fill" style={{width: `${pct}%`}}></div></div>
               <div className="tb-row"><span className="tb-key">Gladiator path slots</span><span className="tb-val">37.5%</span></div>
               <div className="tb-bar"><div className="tb-fill" style={{width:'37.5%'}}></div></div>
             </div>

             <div className="tele-bar-card">
                 <div className="section-hdr" style={{borderBottom:'none', paddingBottom:0, marginBottom:8}}>pi_agent_rust Deterministic Reactor</div>
                 <div className="tb-row"><span className="tb-key">NUMA Slab Tracking</span><span className="tb-val g">Aligned</span></div>
                 <div className="tb-row"><span className="tb-key">Bounded SPSC Lanes</span><span className="tb-val g">Optimal (0 saturated)</span></div>
                 <div className="tb-row"><span className="tb-key">Hostcall Reactor Mesh</span><span className="tb-val g">Deterministic Lock</span></div>
                 <div className="tb-row"><span className="tb-key">Garbage Collection</span><span className="tb-val p">Zero (Rust Ownership)</span></div>
             </div>

             <div className="tele-bar-card">
                <div className="section-hdr" style={{borderBottom:'none', paddingBottom:0, marginBottom:8}}>FFT Spectral Analysis (ISO 10816)</div>
                <div className="tb-row"><span className="tb-key">1x RPM (Unbalance)</span><span className="tb-val a" style={{animation: 'pls 2s infinite'}}>TRIGGERED</span></div>
                <div className="tb-bar" style={{height:'24px', background:'var(--surface-3)', display:'flex', alignItems:'flex-end', gap:'2px', overflow:'visible'}}>
                   {Array.from({length: 30}).map((_, i) => (
                      <div key={i} style={{
                         flex: 1, 
                         backgroundColor: i === 5 ? 'var(--accent)' : i === 10 ? 'var(--amber)' : 'var(--text-m)', 
                         opacity: i === 5 || i === 10 ? 1 : 0.3, 
                         height: i === 5 ? '100%' : i === 10 ? '70%' : `${10 + Math.random()*20}%`,
                         transition: 'height 0.2s ease',
                         borderTopLeftRadius: '2px', borderTopRightRadius: '2px'
                      }}></div>
                   ))}
                </div>
                <div className="tb-row" style={{marginTop:'8px'}}><span className="tb-key">Carpet Noise</span><span className="tb-val g">Stable</span></div>
                <div className="cap-row">
                   <div className="cap-pill" style={{background:'var(--accent-dim)', color:'var(--accent)', borderColor:'var(--border-b)'}}>GAN-Latent-Recon</div>
                   <div className="cap-pill">MCAR</div>
                   <div className="cap-pill">MAR</div>
                   <div className="cap-pill">MNAR</div>
                </div>
             </div>

             <div className="tele-bar-card">
                <div className="section-hdr" style={{borderBottom:'none', paddingBottom:0, marginBottom:8}}>M.E.L.T. Governance Monitor</div>
                <div className="kpi-grid" style={{marginBottom: '10px'}}>
                  <div className="kpi-card" style={{padding:'10px'}}><div className="kpi-label">Metrics</div><div className="kpi-sub">Token Tracking</div></div>
                  <div className="kpi-card" style={{padding:'10px'}}><div className="kpi-label" style={{color:'var(--purple)'}}>Events</div><div className="kpi-sub">Auth Intercepts</div></div>
                  <div className="kpi-card" style={{padding:'10px'}}><div className="kpi-label" style={{color:'var(--amber)'}}>Logs</div><div className="kpi-sub">PII Redacted</div></div>
                  <div className="kpi-card" style={{padding:'10px'}}><div className="kpi-label" style={{color:'var(--green)'}}>Traces</div><div className="kpi-sub">A2A Auditable</div></div>
                </div>
                <div className="tb-row"><span className="tb-key">Zero-Trust Compliance</span><span className="tb-val g">100% SECURE</span></div>
             </div>

             <div className="mt-4 flex flex-col gap-4">
                <SpectralAnalysis data={{ v1x: 80, v2x: 20, carpet: 50 }} />
                <GovernanceMonitor />
                <ComplianceHorizon />
                <BoundedScaling metrics={{phi_ratio: 1.618, carbon_intensity: 0.85, utilization: 0.92, water_risk: 'low'}}/>
                <SEKEDCompiler state={{energy: 0.8, resilience: 0.95, confidence: 0.88, diversity: 0.7, stability: 0.9, directive: 'EXECUTE'}} />
                <UACPLayers layers={[
                  {layer: 'cognitive', status: 'active', latency: 120},
                  {layer: 'context', status: 'isolated', latency: 15},
                  {layer: 'execution', status: 'pending', latency: 10},
                  {layer: 'hitl', status: 'idempotent', latency: 0}
                ]} />
             </div>

             <div className="section-hdr">Event Log</div>
             <div className="event-log">
               {tele.eventLogs.map(e => (
                 <div key={e.id} className="ev-item">
                   <div className={`ev-dot ${e.cls}`}></div>
                   <div className="ev-body" dangerouslySetInnerHTML={{__html: e.text}}></div>
                   <div className="ev-time">{e.time}</div>
                 </div>
               ))}
             </div>
          </div>
        </div>

        {/* Paths View */}
        <div className={`view ${activeView === 'paths' ? 'active' : ''}`} id="v-paths">
          <div className="paths-view">
            <div className="section-hdr">Gladiator Reasoning Engine — Path History</div>
            
            <div className="path-run">
              <div className="path-run-hdr"><span className="path-run-title">Bitmap Transmission (example)</span><span className="path-run-badge">LOCKED</span></div>
              <div className="path-entry"><div className="pe-num">1</div><div className="pe-label">RLE-Delta</div><div className="pe-bar"><div className="pe-fill win" style={{width:'87%'}}></div></div><div className="pe-pct win">87%</div><div className="pe-tag locked">LOCKED</div></div>
              <div className="path-entry"><div className="pe-num">2</div><div className="pe-label">Huffman+Q</div><div className="pe-bar"><div className="pe-fill ok" style={{width:'74%'}}></div></div><div className="pe-pct ok">74%</div><div className="pe-tag locked">LOCKED</div></div>
              <div className="path-entry"><div className="pe-num">3</div><div className="pe-label">LDPC-QEC</div><div className="pe-bar"><div className="pe-fill ok" style={{width:'61%'}}></div></div><div className="pe-pct ok">61%</div><div className="pe-tag locked">LOCKED</div></div>
              <div className="path-entry"><div className="pe-num">4</div><div className="pe-label">Raw-LZ4</div><div className="pe-bar"><div className="pe-fill lose" style={{width:'22%'}}></div></div><div className="pe-pct lose">22%</div><div className="pe-tag pruned">PRUNED</div></div>
              <div className="path-entry"><div className="pe-num">5</div><div className="pe-label">Naive-RLE</div><div className="pe-bar"><div className="pe-fill lose" style={{width:'9%'}}></div></div><div className="pe-pct lose">9%</div><div className="pe-tag pruned">PRUNED</div></div>
            </div>

            <div className="path-run">
              <div className="path-run-hdr"><span className="path-run-title">Heron QPU Calibration (example)</span><span className="path-run-badge">LOCKED</span></div>
              <div className="path-entry"><div className="pe-num">1</div><div className="pe-label">Echoed CR gate</div><div className="pe-bar"><div className="pe-fill win" style={{width:'91%'}}></div></div><div className="pe-pct win">91%</div><div className="pe-tag locked">LOCKED</div></div>
              <div className="path-entry"><div className="pe-num">2</div><div className="pe-label">ZNE mitigation</div><div className="pe-bar"><div className="pe-fill ok" style={{width:'78%'}}></div></div><div className="pe-pct ok">78%</div><div className="pe-tag locked">LOCKED</div></div>
              <div className="path-entry"><div className="pe-num">3</div><div className="pe-label">Rand bench</div><div className="pe-bar"><div className="pe-fill ok" style={{width:'66%'}}></div></div><div className="pe-pct ok">66%</div><div className="pe-tag locked">LOCKED</div></div>
              <div className="path-entry"><div className="pe-num">4</div><div className="pe-label">Naive reset</div><div className="pe-bar"><div className="pe-fill lose" style={{width:'11%'}}></div></div><div className="pe-pct lose">11%</div><div className="pe-tag pruned">PRUNED</div></div>
            </div>
          </div>
        </div>

        {/* Engine View */}
        <div className={`view ${activeView === 'engine' ? 'active' : ''}`} id="v-engine">
          <div className="engine-view">
             <div className="section-hdr" style={{marginTop: '16px'}}>Sovereign Engine Orchestrator</div>
             <div className="provider-select">
                <span>Primary Provider: </span>
                <select value={selectedProvider} onChange={e => setSelectedProvider(e.target.value)}>
                  <option value="google">Google Gemini 3.1 Pro</option>
                  <option value="groq">Groq LPU Array</option>
                  <option value="anthropic">Anthropic Claude</option>
                  <option value="openai">OpenAI GPT-4o</option>
                </select>
             </div>

             <div className="model-card" style={{marginBottom: '16px'}}>
                <div className="section-hdr" style={{borderBottom:'none', paddingBottom:0, marginBottom:8}}>Hybrid Reasoning Architecture</div>
                <div className="model-row"><span className="model-k">Backbone</span><span className="model-v p">Olmo3-Hybrid</span></div>
                <div className="model-row"><span className="model-k">Zeno (Inferential Density)</span><span className="model-v">Optimized Ratio</span></div>
                <div className="model-row"><span className="model-k">Gladiator (Speculation)</span><span className="model-v">Competitive Exploration</span></div>
                <div className="model-row"><span className="model-k">Counterfactual (Simulation)</span><span className="model-v g">Predictive Safety</span></div>
                <div className="model-row"><span className="model-k">Paradigm</span><span className="model-v a">State-over-Tokens (SoT)</span></div>
                <div className="cap-row" style={{marginTop:'8px'}}>
                  <div className="cap-pill">State-Based Recall</div>
                  <div className="cap-pill" style={{background:'var(--accent-dim)', color:'var(--accent)', borderColor:'var(--border-b)'}}>Anti-Collapse Protection</div>
                </div>
             </div>

             <div className="section-hdr" style={{marginTop: '16px'}}>100-Agent Task Force <span style={{float:'right',color:'var(--accent)',fontWeight:'normal'}}>{agentTaskForce.filter(a => a.status === 'executing').length} Active</span></div>
             <div className="agent-grid">
               {agentTaskForce.map(a => (
                 <div key={a.id} className={`agent-node ${a.status}`} title={`${a.role}: ${a.status}`}></div>
               ))}
             </div>
             <div className="agent-legend">
               <div className="al-item"><div className="agent-node idle"></div> Idle</div>
               <div className="al-item"><div className="agent-node assigned"></div> Assigned</div>
               <div className="al-item"><div className="agent-node executing"></div> Executing</div>
               <div className="al-item"><div className="agent-node blocked"></div> Blocked</div>
             </div>

             <div className="section-hdr" style={{marginTop: '16px'}}>Operational Hub Metrics</div>
             <div className="kpi-grid">
               <div className="kpi-card"><div className="kpi-label">Determinism</div><div className="kpi-val o">99.9%</div><div className="kpi-sub">Strict grounding</div></div>
               <div className="kpi-card"><div className="kpi-label">Latency</div><div className="kpi-val g">14ms</div><div className="kpi-sub">Avg roundtrip</div></div>
               <div className="kpi-card"><div className="kpi-label">Consensus</div><div className="kpi-val p">84/100</div><div className="kpi-sub">Agreement index</div></div>
               <div className="kpi-card"><div className="kpi-label">Policy</div><div className="kpi-val a" style={{fontSize:'16px',marginTop:'4px',lineHeight:1}}>ACTIVE</div><div className="kpi-sub">Gopher Watchtower</div></div>
             </div>

             <div className="tele-bar-card" style={{marginTop: '16px'}}>
                <div className="section-hdr" style={{borderBottom:'none', paddingBottom:0, marginBottom:8}}>Industrial ROI Projection</div>
                <div className="tb-row"><span className="tb-key">Breakdown Reduction</span><span className="tb-val g">75%</span></div>
                <div className="tb-bar"><div className="tb-fill" style={{width:'75%', background:'var(--green)', boxShadow:'0 0 8px var(--green)'}}></div></div>
                <div className="tb-row"><span className="tb-key">Labour Cost Decrease</span><span className="tb-val g">45%</span></div>
                <div className="tb-bar"><div className="tb-fill" style={{width:'45%', background:'var(--green)', boxShadow:'0 0 8px var(--green)'}}></div></div>
                <div className="tb-row"><span className="tb-key">Condition-Based Maint.</span><span className="tb-val p">P-F Interval Active</span></div>
             </div>

             <div className="mt-6 flex flex-col gap-4 mb-4">
                <GenomeDNA genome={{hash: 'a38fbd921e', layers: {model: 'Olmo3-Hybrid-8B', prompt: 'SoT-Industrial-v2', policy: 'ZeroTrust-Restricted', watchtower: 'ISO-10816-Guard', task_profile: 'HighRisk-Maintenance'} as any, lineage: []}} />
                <LineageLedger nodes={[{id: 'g1', type: 'genome', label: 'Root Genome', relation: 'ORIGIN'}, {id: 'g2', type: 'state', label: 'Prompt Evolution', relation: 'DERIVED_FROM'}]} />
                <StatePropagationAtlas />
                <ROIPanel />
             </div>
          </div>
        </div>

        {/* Hub View */}
        <div className={`view ${activeView === 'hub' ? 'active' : ''}`} id="v-hub">
          <div className="tele-view">
             <div className="section-hdr">Strategic Orchestration Hub</div>
             <div className="flex flex-col gap-4 mt-4">
                <IntentConsole
                  onExecute={handleHubExecute}
                  isLocked={hubLoading}
                  selectedProvider={hubProvider}
                  onProviderChange={(p) => setHubProvider(p)}
                  providers={PROVIDERS}
                />
                {hubLoading && (
                  <div className="hub-loading">
                    <div className="td" /><div className="td" /><div className="td" />
                    <span>Dispatching intent to {hubProvider} via UACP orchestration plane…</span>
                  </div>
                )}
                {hubOutput && !hubLoading && (
                  <div className="hub-output">
                    <div className="hub-output-hdr">
                      <span>Orchestration Response</span>
                      <span style={{ color: hubOutput.error ? 'var(--red,#f87171)' : 'var(--green)' }}>
                        {hubOutput.error ? '✗ ERROR' : '✓ COMPLETE'}
                      </span>
                    </div>
                    {hubOutput.error
                      ? <span style={{ color: 'var(--red,#f87171)' }}>{hubOutput.message}</span>
                      : hubOutput.result
                        ? <span>{typeof hubOutput.result === 'string' ? hubOutput.result : JSON.stringify(hubOutput.result, null, 2)}</span>
                        : <pre>{JSON.stringify(hubOutput, null, 2)}</pre>
                    }
                  </div>
                )}
                <SignalIngestionFeed signals={[]} />
                <ProbabilityMatrix revision="1.0.4" isCompiled={false} />
                <AgentConsensusMatrix activeNodes={10} consensusModel="Gemini Pro Integrated" />
                <MemoryVault />
                <PolicyEvaluationPanel status="active" />
                <ObservabilitySignals signals={[]} />
                <DeterminismRatio ratio={3.0} certainty={0.9999} noise={0.0001} entropy={0.0} />
                <ArchivesOfOrder isLocked={true} latency={14} coherence={84} progress={0.0000001} />
                <EmissionsTrajectory data={[]} />
                <RegionalEmittersPanel emitters={[]} />
                <MitigationPathwaysPanel />
                <GovernanceRoadmap phases={[]} />
                <IdentityGovernancePanel data={{xaaStatus: 'active', activeAgents: 0, shadowAiDetections: 0, complianceLevel: 100}} />
                <MCPGateway status={{sanitization: 'active', redaction: 'active', auditing: 'active', egress_control: 'active', last_scan_result: 'clear'}} />
                <ThreatLandscape surfaces={[]} />
             </div>
          </div>
        </div>

      </div>

      {/* Bottom Nav */}
      <div className="bnav">
        <div className={`bt ${activeView === 'terminal' ? 'active' : ''}`} onClick={() => setActiveView('terminal')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
          </svg>Terminal
        </div>
        <div className={`bt ${activeView === 'mesh' ? 'active' : ''}`} onClick={() => setActiveView('mesh')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/>
            <line x1="12" y1="7" x2="12" y2="12"/><line x1="12" y1="12" x2="5" y2="17"/><line x1="12" y1="12" x2="19" y2="17"/>
          </svg>Mesh
        </div>
        <div className={`bt ${activeView === 'tele' ? 'active' : ''}`} onClick={() => setActiveView('tele')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
             <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>Telemetry
        </div>
        <div className={`bt ${activeView === 'paths' ? 'active' : ''}`} onClick={() => setActiveView('paths')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
          </svg>Paths
        </div>
        <div className={`bt ${activeView === 'engine' ? 'active' : ''}`} onClick={() => setActiveView('engine')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
             <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/>
          </svg>Engine
        </div>
        <div className={`bt ${activeView === 'hub' ? 'active' : ''}`} onClick={() => setActiveView('hub')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
             <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
          </svg>Hub
        </div>
      </div>
    </div>
  );
}
