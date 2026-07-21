/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { VeklomRun, SpineStep } from '../types';
import { ShieldCheck, Database, Key, HelpCircle, Activity, ChevronRight, Lock, CheckCircle2, AlertTriangle, Play, Copy } from 'lucide-react';

const playLockSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // Low frequency solid locking latch "clunk" sound
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    // Sweep frequency down from 95Hz to 45Hz to simulate heavy mass locking home
    osc.frequency.setValueAtTime(95, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.18);
    
    gain.gain.setValueAtTime(0, ctx.currentTime);
    // Extremely fast attack for the impact thud
    gain.gain.linearRampToValueAtTime(0.7, ctx.currentTime + 0.005);
    // Smooth decay
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    
    // High-pitched triangle click for the metallic shear bolt notch alignment
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(880, ctx.currentTime);
    clickOsc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.04);
    
    clickGain.gain.setValueAtTime(0, ctx.currentTime);
    // Fast attack
    clickGain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.001);
    // Exponential decay
    clickGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    
    // Connect and start
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    clickOsc.connect(clickGain);
    clickGain.connect(ctx.destination);
    
    osc.start();
    clickOsc.start();
    
    osc.stop(ctx.currentTime + 0.3);
    clickOsc.stop(ctx.currentTime + 0.06);
  } catch (err) {
    console.warn('AudioContext failed:', err);
  }
};

interface RunSpineProps {
  runs: VeklomRun[];
  selectedRunId: string | null;
  onSelectRun: (id: string) => void;
}

export default function RunSpine({ runs, selectedRunId, onSelectRun }: RunSpineProps) {
  // Grab the selected run or default to the first one
  const selectedRun = runs.find(r => r.id === selectedRunId) || runs[0];

  const stepsDetails = [
    { name: 'Intent' as SpineStep, icon: HelpCircle, color: '#00E5FF', label: 'EVAL_INTENT' },
    { name: 'Plan' as SpineStep, icon: Activity, color: '#00E5FF', label: 'GEN_SEQUENCE' },
    { name: 'ArbiterOS' as SpineStep, icon: ShieldCheck, color: '#FFAB00', label: 'GOV_ARBITER_POLICY' },
    { name: 'Redis Lua' as SpineStep, icon: Database, color: '#FFAB00', label: 'LUA_STATE_LOCK' },
    { name: 'Attestation' as SpineStep, icon: Key, color: '#00FF66', label: 'STATE_ATTEST_SEAL' },
  ];

  // Helper check for attestation states
  const isCompleted = selectedRun.status === 'completed';
  const isFailed = selectedRun.status === 'failed';
  const isRunning = selectedRun.status === 'running';

  const [lastCommittedId, setLastCommittedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    if (isCompleted && selectedRun.id !== lastCommittedId) {
      setLastCommittedId(selectedRun.id);
      playLockSound();
    }
  }, [selectedRun.id, isCompleted, lastCommittedId]);

  return (
    <div className="w-full h-full flex bg-[#030303] select-none">
      
      {/* LEFT PANEL: Dense Runs Tick Ledger List */}
      <div className="w-80 h-full border-r border-white/10 bg-black flex flex-col justify-between shrink-0 font-mono">
        <div className="p-3.5 border-b border-white/10 bg-black/60">
          <div className="text-[10px] text-white/40 uppercase tracking-widest font-black mb-1">PROOFS LEDGER FEED</div>
          <div className="text-white text-xs font-bold font-sans">VeklomRun Proof Pipelines</div>
        </div>

        <div className="flex-grow overflow-y-auto divide-y divide-white/5 max-h-[calc(100vh-100px)]">
          {runs.map((run) => {
            const isSel = run.id === selectedRun.id;
            return (
              <button
                key={run.id}
                onClick={() => onSelectRun(run.id)}
                className={`w-full p-3.5 text-left transition-all duration-200 block border-l-2 relative cursor-pointer ${
                  isSel ? 'bg-white/[0.03] border-l-electric-cyan' : 'border-l-transparent hover:bg-white/[0.015]'
                }`}
                style={{ contentVisibility: 'auto' }}
              >
                <div className="flex items-center justify-between text-[10px] mb-1.5 string-content">
                  <span className="text-white font-bold">{run.id}</span>
                  <span className={`px-1.5 py-0.5 rounded-none text-[8.5px] uppercase font-bold flex items-center gap-1 ${
                    run.status === 'completed' ? 'text-matrix-emerald bg-matrix-emerald/10 border border-matrix-emerald/20' :
                    run.status === 'failed' ? 'text-laser-red bg-laser-red/10 border border-laser-red/20' :
                    'text-electric-cyan bg-electric-cyan/10 border border-electric-cyan/20 animate-pulse'
                  }`}>
                    {run.status === 'running' && <span className="w-1 h-1 bg-electric-cyan animate-ping" />}
                    {run.status}
                  </span>
                </div>
                
                <h4 className="text-white/80 font-sans text-xs line-clamp-2 leading-relaxed mb-2 tracking-tight">
                  {run.intent}
                </h4>

                <div className="flex items-center justify-between text-[9px] text-white/35 font-mono">
                  <span>{run.duration}</span>
                  <span>{run.timestamp.substring(11, 19)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* RIGHT PANEL: Cinematic PGL Proof Spine & Attestation Ring */}
      <div className="flex-grow h-full flex flex-col md:flex-row p-6 overflow-y-auto max-h-full font-mono gap-6 justify-center items-center">
        
        {/* Detail Pipeline timelines */}
        <div className="w-full max-w-lg space-y-4">
          <div className="mb-2">
            <div className="group/id flex items-center gap-2.5 mb-1.5 min-h-[18px]">
              <span className={`text-[10px] tracking-widest uppercase font-bold transition-all duration-300 ${
                copiedId ? 'text-matrix-emerald font-extrabold animate-pulse' : 'text-electric-cyan'
              }`}>
                {selectedRun.id} <span className="text-white/40 font-normal">• PGL CONVENIENCE TRAIL</span>
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(selectedRun.id);
                  setCopiedId(true);
                  setTimeout(() => setCopiedId(false), 1500);
                }}
                className="opacity-0 group-hover/id:opacity-100 transition-opacity duration-200 bg-white/5 hover:bg-white/10 border border-white/10 px-1.5 py-0.5 text-[8px] tracking-widest text-white/80 uppercase font-mono cursor-pointer flex items-center gap-1 select-none"
                title="Copy Run ID"
              >
                <Copy className="w-2.5 h-2.5" />
                Copy ID
              </button>
            </div>
            <h2 className="text-white text-base font-bold font-sans tracking-tight mb-2 leading-snug">
              {selectedRun.intent}
            </h2>
            <div className="flex gap-4 text-[10px] text-white/50 border-b border-white/10 pb-3.5">
              <span>Duration: <strong className="text-white">{selectedRun.duration}</strong></span>
              <span>Evidence hashes: <strong className="text-matrix-emerald">{selectedRun.evidenceCount} Sealed</strong></span>
              <span>Consensus Slot: <strong className="text-white">#{selectedRun.hash.substring(3, 10)}</strong></span>
            </div>
          </div>

          {/* Spine Steps */}
          <div className="relative pl-7 space-y-5">
            {/* Timeline backbone trail wire */}
            <div className="absolute left-2.5 top-2.5 bottom-2.5 w-[2px] bg-white/[0.05]" />
            {/* Glowing active wire overlays */}
            <div 
              className="absolute left-2.5 top-2.5 bg-gradient-to-b from-electric-cyan to-matrix-emerald w-[2px] transition-all duration-500" 
              style={{
                height: `${
                  selectedRun.currentStep === 'Intent' ? '0%' :
                  selectedRun.currentStep === 'Plan' ? '25%' :
                  selectedRun.currentStep === 'ArbiterOS' ? '50%' :
                  selectedRun.currentStep === 'Redis Lua' ? '75%' : '100%'
                }`
              }}
            />

            {stepsDetails.map((step, idx) => {
              const runStepObj = selectedRun.steps.find(s => s.name === step.name) || selectedRun.steps[idx];
              const isStepCompleted = runStepObj.status === 'completed';
              const isStepActive = runStepObj.status === 'active';
              const isStepFailed = runStepObj.status === 'failed';
              const StepIcon = step.icon;

              return (
                <motion.div
                  key={step.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className={`relative p-3.5 rounded-none border ${
                    isStepActive ? 'bg-black/60 border-electric-cyan/40 shadow-[0_0_15px_rgba(0,229,255,0.04)]' :
                    isStepFailed ? 'bg-laser-red/[0.03] border-laser-red/40' :
                    isStepCompleted ? 'bg-[#0A0A0C] border-white/5' : 'bg-transparent border-white/[0.02] opacity-40'
                  }`}
                >
                  {/* Spine core pin circle */}
                  <div
                    className={`absolute -left-[24px] top-4.5 w-3 h-3 rounded-none border-2 transition-all duration-300 flex items-center justify-center ${
                      isStepFailed ? 'bg-laser-red border-laser-red shadow-[0_0_8px_#ff003c]' :
                      isStepCompleted ? 'bg-matrix-emerald border-matrix-emerald shadow-[0_0_8px_#00ff66]' :
                      isStepActive ? 'bg-electric-cyan border-electric-cyan shadow-[0_0_8px_#00e5ff] scale-110' :
                      'bg-black border-white/20'
                    }`}
                  >
                    {isStepCompleted && <div className="w-1 h-1 bg-black" />}
                  </div>

                  <div className="flex items-center justify-between text-[10px] mb-1 font-mono tracking-wider">
                    <span className="text-white/40 uppercase">{step.label}</span>
                    <span className={`font-bold uppercase ${
                      isStepFailed ? 'text-laser-red-glow text-laser-red' :
                      isStepCompleted ? 'text-matrix-emerald' :
                      isStepActive ? 'text-electric-cyan animate-pulse' : 'text-white/20'
                    }`}>
                      {runStepObj.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-1.5">
                    <StepIcon className={`w-3.5 h-3.5 ${
                      isStepFailed ? 'text-laser-red' :
                      isStepCompleted ? 'text-matrix-emerald' :
                      isStepActive ? 'text-electric-cyan' : 'text-white/30'
                    }`} />
                    <h5 className="text-white font-sans text-xs font-bold tracking-tight">{step.name}</h5>
                  </div>

                  <p className="text-[11px] text-white/60 leading-normal font-sans">
                    {runStepObj.details}
                  </p>

                  {runStepObj.hash && (
                    <div className="mt-2 text-[9px] text-[#ffffff33] font-mono select-all truncate break-all selection:bg-electric-cyan/20 selector-all">
                      Hash Seal: {runStepObj.hash}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Cinematic SVG 3-layer Lock Attestation Ring */}
        <div className="flex flex-col items-center justify-center p-6 border border-white/10 bg-[#0A0A0C] rounded-none max-w-sm w-full relative">
          
          <div className="absolute top-4 left-4 font-mono text-[9px] text-white/30 tracking-widest uppercase">
            ATTESTATION CORE COUPLER
          </div>

          {/* Compute status of the three verification layers dynamically */}
          {(() => {
            const getLayerStatus = (layerName: 'SEKED' | 'ArbiterOS' | 'ConvergeOS') => {
              if (isCompleted) return 'passed';
              if (isFailed) {
                const planStep = selectedRun.steps.find(s => s.name === 'Plan');
                const arbiterStep = selectedRun.steps.find(s => s.name === 'ArbiterOS');
                const redisStep = selectedRun.steps.find(s => s.name === 'Redis Lua');
                const attestStep = selectedRun.steps.find(s => s.name === 'Attestation');

                if (layerName === 'SEKED') {
                  if (planStep?.status === 'failed') return 'failed';
                  if (planStep?.status === 'pending') return 'pending';
                  return 'passed';
                }
                if (layerName === 'ArbiterOS') {
                  if (arbiterStep?.status === 'failed') return 'failed';
                  if (arbiterStep?.status === 'pending') return 'pending';
                  return 'passed';
                }
                if (layerName === 'ConvergeOS') {
                  if (redisStep?.status === 'failed' || attestStep?.status === 'failed') return 'failed';
                  if (redisStep?.status === 'pending' || attestStep?.status === 'pending') return 'pending';
                  return 'passed';
                }
              }
              
              if (isRunning) {
                if (layerName === 'SEKED') {
                  const planStep = selectedRun.steps.find(s => s.name === 'Plan');
                  if (planStep?.status === 'completed') return 'passed';
                  if (planStep?.status === 'active') return 'active';
                  return 'pending';
                }
                if (layerName === 'ArbiterOS') {
                  const arbiterStep = selectedRun.steps.find(s => s.name === 'ArbiterOS');
                  if (arbiterStep?.status === 'completed') return 'passed';
                  if (arbiterStep?.status === 'active') return 'active';
                  return 'pending';
                }
                if (layerName === 'ConvergeOS') {
                  const redisStep = selectedRun.steps.find(s => s.name === 'Redis Lua');
                  const attestStep = selectedRun.steps.find(s => s.name === 'Attestation');
                  if (attestStep?.status === 'completed' || attestStep?.status === 'active') return 'active';
                  if (redisStep?.status === 'completed') return 'passed';
                  if (redisStep?.status === 'active') return 'active';
                  return 'pending';
                }
              }
              
              return 'pending';
            };

            const sekedStatus = getLayerStatus('SEKED');
            const arbiterStatus = getLayerStatus('ArbiterOS');
            const convergeStatus = getLayerStatus('ConvergeOS');
            const allPassed = sekedStatus === 'passed' && arbiterStatus === 'passed' && convergeStatus === 'passed';

            return (
              <>
                <div className="relative w-64 h-64 flex items-center justify-center my-6">
                  <svg viewBox="0 0 256 256" className="absolute inset-0 w-full h-full select-none">
                    <defs>
                      <filter id="emerald-glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="6" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                      <filter id="cyan-glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                      <filter id="amber-glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>

                    {/* Backing guides */}
                    <circle cx="128" cy="128" r="102" stroke="rgba(255,255,255,0.02)" strokeWidth="1" fill="none" />
                    <circle cx="128" cy="128" r="82" stroke="rgba(255,255,255,0.02)" strokeWidth="1" fill="none" />
                    <circle cx="128" cy="128" r="62" stroke="rgba(255,255,255,0.02)" strokeWidth="1" fill="none" />

                    {/* OUTER LAYER: SEKED (R = 102) */}
                    {sekedStatus !== 'pending' && (
                      <motion.circle
                        cx="128"
                        cy="128"
                        r="102"
                        fill="none"
                        animate={allPassed ? {
                          stroke: '#00FF66',
                          strokeDasharray: '640',
                          strokeDashoffset: 0,
                          strokeWidth: 4,
                          strokeOpacity: 0.9,
                          rotate: 360,
                        } : sekedStatus === 'passed' ? {
                          stroke: '#00E5FF',
                          strokeDasharray: '640',
                          strokeDashoffset: 0,
                          strokeWidth: 2.5,
                          strokeOpacity: 0.8,
                          rotate: 0,
                        } : sekedStatus === 'failed' ? {
                          stroke: '#FF003C',
                          strokeDasharray: '20 15',
                          strokeDashoffset: [0, 350],
                          strokeWidth: 2.5,
                          strokeOpacity: 0.9,
                        } : { // active
                          stroke: '#00E5FF',
                          strokeDasharray: '180 180',
                          strokeDashoffset: [0, 360],
                          strokeWidth: 2,
                          strokeOpacity: 0.6,
                        }}
                        transition={allPassed ? {
                          rotate: { type: 'spring', stiffness: 180, damping: 15 },
                          default: { duration: 0.6 }
                        } : sekedStatus === 'active' ? {
                          strokeDashoffset: { repeat: Infinity, duration: 6, ease: 'linear' }
                        } : sekedStatus === 'failed' ? {
                          strokeDashoffset: { repeat: Infinity, duration: 15, ease: 'linear' }
                        } : { duration: 0.5 }}
                        style={{ originX: '128px', originY: '128px', transformOrigin: '128px 128px' }}
                        filter={allPassed ? 'url(#emerald-glow)' : sekedStatus === 'active' ? 'url(#cyan-glow)' : undefined}
                      />
                    )}

                    {/* MIDDLE LAYER: ArbiterOS (R = 82) */}
                    {arbiterStatus !== 'pending' && (
                      <motion.circle
                        cx="128"
                        cy="128"
                        r="82"
                        fill="none"
                        animate={allPassed ? {
                          stroke: '#00FF66',
                          strokeDasharray: '515',
                          strokeDashoffset: 0,
                          strokeWidth: 4,
                          strokeOpacity: 0.85,
                          rotate: -360,
                        } : arbiterStatus === 'passed' ? {
                          stroke: '#FFAB00',
                          strokeDasharray: '515',
                          strokeDashoffset: 0,
                          strokeWidth: 2.5,
                          strokeOpacity: 0.8,
                          rotate: 0,
                        } : arbiterStatus === 'failed' ? {
                          stroke: '#FF003C',
                          strokeDasharray: '15 10',
                          strokeDashoffset: [0, -250],
                          strokeWidth: 2.5,
                          strokeOpacity: 0.9,
                        } : { // active
                          stroke: '#FFAB00',
                          strokeDasharray: '140 140',
                          strokeDashoffset: [360, 0],
                          strokeWidth: 2,
                          strokeOpacity: 0.6,
                        }}
                        transition={allPassed ? {
                          rotate: { type: 'spring', stiffness: 180, damping: 15 },
                          default: { duration: 0.6 }
                        } : arbiterStatus === 'active' ? {
                          strokeDashoffset: { repeat: Infinity, duration: 5, ease: 'linear' }
                        } : arbiterStatus === 'failed' ? {
                          strokeDashoffset: { repeat: Infinity, duration: 12, ease: 'linear' }
                        } : { duration: 0.5 }}
                        style={{ originX: '128px', originY: '128px', transformOrigin: '128px 128px' }}
                        filter={allPassed ? 'url(#emerald-glow)' : arbiterStatus === 'active' ? 'url(#amber-glow)' : undefined}
                      />
                    )}

                    {/* INNER LAYER: ConvergeOS (R = 62) */}
                    {convergeStatus !== 'pending' && (
                      <motion.circle
                        cx="128"
                        cy="128"
                        r="62"
                        fill="none"
                        animate={allPassed ? {
                          stroke: '#00FF66',
                          strokeDasharray: '390',
                          strokeDashoffset: 0,
                          strokeWidth: 4,
                          strokeOpacity: 0.8,
                          rotate: 360,
                        } : convergeStatus === 'passed' ? {
                          stroke: '#00FF66',
                          strokeDasharray: '390',
                          strokeDashoffset: 0,
                          strokeWidth: 2.5,
                          strokeOpacity: 0.8,
                          rotate: 0,
                        } : convergeStatus === 'failed' ? {
                          stroke: '#FF003C',
                          strokeDasharray: '10 8',
                          strokeDashoffset: [0, 200],
                          strokeWidth: 2.5,
                          strokeOpacity: 0.9,
                        } : { // active
                          stroke: '#00FF66',
                          strokeDasharray: '100 100',
                          strokeDashoffset: [0, 360],
                          strokeWidth: 2,
                          strokeOpacity: 0.6,
                        }}
                        transition={allPassed ? {
                          rotate: { type: 'spring', stiffness: 180, damping: 15 },
                          default: { duration: 0.6 }
                        } : convergeStatus === 'active' ? {
                          strokeDashoffset: { repeat: Infinity, duration: 4, ease: 'linear' }
                        } : convergeStatus === 'failed' ? {
                          strokeDashoffset: { repeat: Infinity, duration: 10, ease: 'linear' }
                        } : { duration: 0.5 }}
                        style={{ originX: '128px', originY: '128px', transformOrigin: '128px 128px' }}
                        filter={allPassed ? 'url(#emerald-glow)' : convergeStatus === 'active' ? 'url(#emerald-glow)' : undefined}
                      />
                    )}
                  </svg>

                  {/* Core Lock State icon */}
                  <motion.div
                    animate={allPassed ? {
                      scale: [1, 1.25, 0.95, 1],
                      borderColor: '#00FF66',
                      boxShadow: '0 0 25px rgba(0, 255, 102, 0.45)',
                    } : isFailed ? {
                      scale: 1,
                      rotate: [0, 10, -10, 0],
                      borderColor: '#FF003C',
                      boxShadow: '0 0 15px rgba(255, 0, 60, 0.25)',
                    } : {
                      scale: 1,
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      boxShadow: '0 0 0px rgba(0,0,0,0)',
                    }}
                    transition={allPassed ? {
                      scale: { duration: 0.45, ease: 'easeOut' },
                      default: { duration: 0.3 }
                    } : { duration: 0.3 }}
                    className={`absolute flex flex-col items-center justify-center p-4 rounded-none bg-black border ${
                      allPassed ? 'border-matrix-emerald' : isFailed ? 'border-laser-red' : 'border-white/10'
                    }`}
                  >
                    {allPassed ? (
                      <CheckCircle2 className="w-8 h-8 text-matrix-emerald animate-pulse" />
                    ) : isFailed ? (
                      <AlertTriangle className="w-8 h-8 text-laser-red animate-bounce" style={{ animationDuration: '2s' }} />
                    ) : isRunning ? (
                      <Activity className="w-8 h-8 text-electric-cyan animate-spin" style={{ animationDuration: '3s' }} />
                    ) : (
                      <Lock className="w-8 h-8 text-white/30" />
                    )}
                  </motion.div>
                </div>

                {/* Validation Checklist UI representation */}
                <div className="w-full space-y-2 border-t border-white/10 pt-4.5 font-mono text-[11px]">
                  <div className="flex items-center justify-between text-white/60 font-medium">
                    <span className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 ${
                        sekedStatus === 'passed' ? 'bg-matrix-emerald' : 
                        sekedStatus === 'failed' ? 'bg-laser-red' : 
                        sekedStatus === 'active' ? 'bg-electric-cyan animate-pulse' : 'bg-white/10'
                      }`} /> 
                      1. SEKED ENCLAVEMENT Check
                    </span>
                    <strong className={
                      sekedStatus === 'passed' ? 'text-matrix-emerald font-bold' : 
                      sekedStatus === 'failed' ? 'text-laser-red font-bold' : 
                      sekedStatus === 'active' ? 'text-electric-cyan animate-pulse font-bold' : 'text-white/20'
                    }>
                      {sekedStatus === 'passed' ? 'PASSED' : sekedStatus === 'failed' ? 'REVOKED' : sekedStatus === 'active' ? 'EVALUATING' : 'PENDING'}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between text-white/60 font-medium">
                    <span className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 ${
                        arbiterStatus === 'passed' ? 'bg-matrix-emerald' : 
                        arbiterStatus === 'failed' ? 'bg-laser-red' : 
                        arbiterStatus === 'active' ? 'bg-hazard-amber animate-pulse' : 'bg-white/10'
                      }`} />
                      2. ArbiterOS Policy Match
                    </span>
                    <strong className={
                      arbiterStatus === 'passed' ? 'text-matrix-emerald font-bold' : 
                      arbiterStatus === 'failed' ? 'text-laser-red font-bold' : 
                      arbiterStatus === 'active' ? 'text-hazard-amber animate-pulse font-bold' : 'text-white/20'
                    }>
                      {arbiterStatus === 'passed' ? 'PASSED' : arbiterStatus === 'failed' ? 'VIOLATED' : arbiterStatus === 'active' ? 'EVALUATING' : 'PENDING'}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between text-white/60 font-medium">
                    <span className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 ${
                        convergeStatus === 'passed' ? 'bg-matrix-emerald' : 
                        convergeStatus === 'failed' ? 'bg-laser-red' : 
                        convergeStatus === 'active' ? 'bg-matrix-emerald animate-pulse' : 'bg-white/10'
                      }`} />
                      3. ConvergeOS State Seal
                    </span>
                    <strong className={
                      convergeStatus === 'passed' ? 'text-matrix-emerald font-bold' : 
                      convergeStatus === 'failed' ? 'text-laser-red font-bold' : 
                      convergeStatus === 'active' ? 'text-matrix-emerald animate-pulse font-bold' : 'text-white/20'
                    }>
                      {convergeStatus === 'passed' ? 'SEALED' : convergeStatus === 'failed' ? 'ABORTED' : convergeStatus === 'active' ? 'SEALING' : 'PENDING'}
                    </strong>
                  </div>
                </div>

                <div className="mt-4 p-2 bg-white/[0.01] border border-white/5 rounded-none w-full text-center text-[10px] text-white/40 uppercase font-black">
                  {allPassed && <span className="text-matrix-emerald text-glow-emerald font-bold">● COUPLER SECURELY LOCKED</span>}
                  {isFailed && <span className="text-laser-red text-glow-red font-bold">● COUPLER STATE ABORTED</span>}
                  {isRunning && !allPassed && <span className="text-electric-cyan font-bold tracking-widest animate-pulse">● SECURING ENCLAVE LOCKS...</span>}
                  {!isRunning && !isFailed && !allPassed && <span className="text-white/30 font-bold tracking-widest">● COUPLER STANDBY</span>}
                </div>
              </>
            );
          })()}

        </div>

      </div>

    </div>
  );
}
