import React from 'react';
import { motion } from 'motion/react';
import { GitBranch, History, ChevronRight } from 'lucide-react';
import { PGLNode } from '../types';

interface LineageLedgerProps {
  nodes: PGLNode[];
}

export const LineageLedger: React.FC<LineageLedgerProps> = ({ nodes }) => {
  return (
    <div className="bg-white/5 rounded-2xl border border-white/10 p-6 flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-2">
        <GitBranch size={18} className="text-amber-400" />
        <h2 className="text-sm font-mono uppercase tracking-widest text-white/80">Project Genome Ledger (PGL)</h2>
      </div>

      <div className="space-y-4 relative">
        <div className="absolute left-4 top-4 bottom-4 w-px bg-white/5 border-l border-dashed border-white/10" />
        
        {nodes.map((node, i) => (
          <motion.div 
            key={node.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center gap-4 relative z-10"
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border shadow-lg ${
              node.type === 'genome' ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-400' : 'bg-amber-500/20 border-amber-400/50 text-amber-400'
            }`}>
              {node.type === 'genome' ? <History size={14} /> : <GitBranch size={14} />}
            </div>
            
            <div className="flex-1 p-3 rounded-xl bg-black/40 border border-white/5 hover:border-white/20 transition-all flex items-center justify-between group">
              <div className="flex flex-col">
                <span className="text-[10px] font-mono text-white/30 uppercase tracking-tighter">{node.relation || 'ORIGIN'}</span>
                <span className="text-xs font-medium text-white/80">{node.label}</span>
              </div>
              <ChevronRight size={14} className="text-white/10 group-hover:text-white/40 transition-colors" />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-4 p-4 rounded-xl bg-amber-400/5 border border-amber-400/10 text-[9px] font-mono leading-relaxed text-white/40 flex flex-col gap-1">
         <div className="text-amber-400 uppercase font-bold text-[10px]">Merkle DAG Consensus</div>
         <p>Every transition commitConstitutionalWrite emits a cryptographically linked certificate (Ed25519) ensuring zero governance drift.</p>
      </div>
    </div>
  );
};
