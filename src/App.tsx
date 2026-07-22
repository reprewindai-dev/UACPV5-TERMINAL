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
import { LLMProvider, ProviderConfig, AgentNode, VeklomRun, Delegate, TelemetryTick } from './types';

// RealTerminal imports
import SwarmMap from './components/SwarmMap';
import RunSpine from './components/RunSpine';
import CouncilMatrix from './components/CouncilMatrix';
import DataGrid from './components/DataGrid';
import LiveTelemetry from './components/LiveTelemetry';
import AmbientIntervention from './components/AmbientIntervention';
import CPSidebar from './components/Sidebar';
import { controlStore } from './data/simulation';

// Type definitions to help manage the state
type ViewType = 'terminal' | 'mesh' | 'tele' | 'paths' | 'engine' | 'hub' | 'climate' | 'security' | 'dashboard';
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

    return (
    <div className="w-screen h-screen bg-[#030303] text-white/90 overflow-hidden flex flex-col font-sans border-4 border-[#0A0A0C] relative">
      {/* Futuristic Scanline CRT overlay for cinematic feel */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-electric-cyan/2 w-full animate-scanline pointer-events-none z-50" />
      
      {/* Header */}
      <header className="h-12 border-b border-white/10 flex items-center justify-between px-4 bg-black/40 backdrop-blur-md z-50 shrink-0 select-none">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]"></div>
            <span className="text-xs font-bold tracking-[0.2em] uppercase">UACP V5 Control Plane</span>
          </div>
          <div className="h-4 w-px bg-white/20"></div>
          <div className="flex gap-4 font-mono text-[10px] text-white/50">
            <span>NODE_ID: US-EAST-B82</span>
            <span>LATENCY: 4MS</span>
            <span className="text-[#00FF66]">OS_HEALTH: 100%</span>
          </div>
        </div>
        <div className="flex items-center gap-16 font-mono text-[10px]">
          <div className="flex items-center gap-4">
            <span className="text-white/40 tracking-widest">ARBITER OS STATUS</span>
            <span className="text-[#00FF66] font-bold tracking-wider">ENFORCING / MODE_01</span>
          </div>
        </div>
      </header>

      {/* Main Content Split Frame */}
      <div className="flex-grow flex overflow-hidden relative">
        {/* Primary Navigation Sidebar */}
        <CPSidebar
          activeTab={cpTab}
          setActiveTab={setCpTab}
          mcpHeartbeat="NORMAL"
          throughput={cpMetrics.throughput}
          agentsCount={cpAgents.length}
        />

        {/* Central Application Viewport */}
        <main className="flex-grow flex flex-col justify-between overflow-hidden relative min-w-0 border-l border-white/5">
          
          {/* VIEW CONTAINER */}
          <div className="flex-grow overflow-y-auto relative bg-[#030303]">
            {/* The old real terminal views */}
            {cpTab === 'overview' && (
              <SwarmMap agents={cpAgents} onAgentUpdate={handleCpAgentUpdate} />
            )}
            {cpTab === 'spine' && (
              <RunSpine runs={cpRuns} selectedRunId={cpSelectedRun} onSelectRun={setCpSelectedRun} />
            )}
            {cpTab === 'runs' && (
              <DataGrid runs={cpRuns} />
            )}
            {cpTab === 'committee' && (
              <CouncilMatrix delegates={cpDelegates} onVotePropose={handleCpVotePropose} />
            )}
            {cpTab === 'nexus' && (
              <div className="p-8 text-white/50 font-mono text-sm">Nexus Protocol Interface...</div>
            )}
            {cpTab === 'incidents' && (
              <div className="p-8 text-white/50 font-mono text-sm">VNP Incidents Panel...</div>
            )}

            {/* The integrated UACPV5 Views */}
            {cpTab === 'terminal' && (
              <div className="view active h-full" id="v-terminal">
                <div className="chips-bar p-4">
                  <div className="chip" onClick={() => submitCmd()}>📡 Bitmap tx</div>
                  <div className="chip" onClick={() => submitCmd()}>⚡ Heron calib</div>
                  <div className="chip" onClick={() => submitCmd()}>♻️ CO2 route</div>
                  <div className="chip" onClick={() => submitCmd()}>⏱ Zeno inter</div>
                  <div className="chip" onClick={() => submitCmd()}>🌐 MCP mesh</div>
                </div>
                <div className="term-out" ref={outRef}>
                  {logs.map(l => (
                    <div key={l.id} className={`log ${l.type}`}>
                      {l.isSpec ? (
                        <div className="spec-tree">
                          {l.specPaths?.map((p,i) => (
                            <div key={i} className={`spec-node ${p.locked?'locked':''} ${p.pruned?'pruned':''} ${p.ok?'ok':''}`}>
                              <span className="br">├─</span> {p.l} <span className="val">{p.v}</span>
                            </div>
                          ))}
                        </div>
                      ) : l.isMesh ? (
                        <div className="mesh-pulse">
                          <div className="node src">Veklom</div>
                          <div className="link"><div className="dot"></div></div>
                          <div className="node dst">{l.meshLbl}</div>
                        </div>
                      ) : l.isRaw ? (
                        <pre className="raw-dump">{l.text}</pre>
                      ) : (
                        <span dangerouslySetInnerHTML={{__html: l.text}} />
                      )}
                    </div>
                  ))}
                  {isTyping && <div className="log typing"><span className="cursor"></span></div>}
                </div>
                <div className="term-in p-4 border-t border-white/10">
                  <span className="prompt">❯</span>
                  <input
                    value={inputVal}
                    onChange={e => setInputVal(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && submitCmd()}
                    placeholder="Enter command or protocol..."
                    spellCheck={false}
                    autoFocus
                  />
                </div>
                <ZenoCanvas zenoOn={zenoState.on} zenoLabel={zenoState.lbl} />
              </div>
            )}

            {cpTab === 'mesh' && (
              <div className="view active" id="v-mesh">
                <div className="mesh-view p-4 h-full overflow-y-auto">
                   <div className="section-hdr text-electric-cyan font-bold mb-4">MCP Host–Client–Server Topology</div>
                   <StatePropagationAtlas />
                </div>
              </div>
            )}

            {cpTab === 'tele' && (
              <div className="view active" id="v-tele">
                <div className="tele-view p-4 h-full overflow-y-auto">
                   <div className="section-hdr text-electric-cyan font-bold mb-4">Live System Metrics</div>
                   <div className="tele-grid grid grid-cols-2 gap-4">
                     <SpectralAnalysis />
                     <GenomeDNA />
                   </div>
                   <div className="mt-8">
                     <ComplianceHorizon />
                   </div>
                   <div className="mt-8">
                     <ArchivesOfOrder />
                   </div>
                </div>
              </div>
            )}

            {cpTab === 'paths' && (
              <div className="view active" id="v-paths">
                <div className="paths-view p-4 h-full overflow-y-auto">
                  <div className="section-hdr text-electric-cyan font-bold mb-4">Gladiator Reasoning Engine — Path History</div>
                  <LineageLedger />
                  <div className="mt-8">
                     <EmissionsTrajectory />
                  </div>
                </div>
              </div>
            )}

            {cpTab === 'engine' && (
              <div className="view active" id="v-engine">
                <div className="engine-view p-4 h-full overflow-y-auto">
                   <div className="section-hdr text-electric-cyan font-bold mb-4">Sovereign Engine Orchestrator</div>
                   <ROIPanel />
                   <div className="mt-8 grid grid-cols-2 gap-4">
                     <BoundedScaling />
                     <DeterminismRatio />
                   </div>
                   <div className="mt-8">
                     <GovernanceRoadmap phases={[]} />
                   </div>
                   <div className="mt-8">
                     <IdentityGovernancePanel data={{xaaStatus: 'active', activeAgents: 0, shadowAiDetections: 0, complianceLevel: 100}} />
                   </div>
                   <div className="mt-8">
                     <ThreatLandscape surfaces={[]} />
                   </div>
                </div>
              </div>
            )}

            {cpTab === 'hub' && (
              <div className="view active" id="v-hub">
                <div className="tele-view p-4 h-full overflow-y-auto">
                   <div className="section-hdr text-electric-cyan font-bold mb-4">Strategic Orchestration Hub</div>
                   <div className="tele-grid grid grid-cols-2 gap-4">
                     <IntentConsole 
                       provider={hubProvider}
                       onProviderChange={setHubProvider}
                       onRunIntent={async (intent) => {
                         setHubLoading(true);
                         await new Promise(r => setTimeout(r, 1200));
                         setHubOutput({ status: 'success', confidence: 0.94 });
                         setHubLoading(false);
                       }}
                       isLoading={hubLoading}
                       output={hubOutput}
                     />
                     <PolicyEvaluationPanel />
                   </div>
                   <div className="mt-8 grid grid-cols-2 gap-4">
                     <AgentConsensusMatrix />
                     <SEKEDCompiler />
                   </div>
                   <div className="mt-8">
                     <MemoryVault />
                   </div>
                </div>
              </div>
            )}

            {cpTab === 'dashboard' && (
              <div className="view active" id="v-dashboard">
                <div className="p-4 h-full overflow-y-auto">
                  <AmbientIntervention />
                  <div className="mt-8 grid grid-cols-2 gap-4">
                    <UACPLayers />
                    <MCPGateway status={{sanitization: 'active', redaction: 'active', auditing: 'active', egress_control: 'active', last_scan_result: 'clear'}} />
                  </div>
                  <div className="mt-8 grid grid-cols-2 gap-4">
                     <ProbabilityMatrix />
                     <RegionalEmittersPanel />
                  </div>
                  <div className="mt-8">
                     <SignalIngestionFeed />
                  </div>
                  <div className="mt-8">
                     <GovernanceMonitor />
                  </div>
                  <div className="mt-8">
                     <MitigationPathwaysPanel />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Live Telemetry Console Ticker */}
          <div className="h-72 border-t border-white/[0.05] bg-[#030303] shrink-0 relative z-10 select-none">
            <LiveTelemetry
              logs={cpLogs}
              metrics={cpMetrics}
              onTriggerManualOverride={handleCpManualOverride}
            />
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="h-6 border-t border-white/10 bg-black flex items-center justify-between px-4 text-[9px] font-mono text-white/30 shrink-0 select-none">
        <div className="flex gap-4">
          <span>ENCRYPT: TLS_1.3_CHACHA20_POLY1305</span>
          <span>SESSION: B82-ALPHA-77</span>
        </div>
        <div className="flex gap-4">
          <span className="text-[#00FF66]">● UACP_CORE_UP</span>
          <span className="text-[#00E5FF]">● MCP_BUS_CONNECTED</span>
        </div>
      </footer>
    </div>
  );
}
