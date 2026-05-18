import React, { useState, useEffect } from 'react';

interface MCPStatus {
  connected: boolean;
  reconnecting: boolean;
  reconnectAttempts: number;
  lastConnected: string | null;
  uptime: number;
}

export const MCPStatusIndicator: React.FC = () => {
  const [status, setStatus] = useState<MCPStatus>({
    connected: false,
    reconnecting: false,
    reconnectAttempts: 0,
    lastConnected: null,
    uptime: 0,
  });
  const [blink, setBlink] = useState(true);

  useEffect(() => {
    let mounted = true;

    const poll = async () => {
      try {
        const res = await fetch('/api/mcp/status');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (mounted) setStatus(data);
      } catch {
        if (mounted) setStatus(prev => ({ ...prev, connected: false }));
      }
    };

    poll();
    const interval = setInterval(poll, 5000);
    const blinkInterval = setInterval(() => setBlink(b => !b), 1000);

    return () => {
      mounted = false;
      clearInterval(interval);
      clearInterval(blinkInterval);
    };
  }, []);

  if (status.reconnecting) {
    return (
      <div className="mcp-status reconnecting" title="MCP Server reconnecting...">
        <div className={`mcp-dot ${blink ? 'on' : ''}`} style={{ background: 'var(--amber)' }} />
        <span>MCP RECONNECTING ({status.reconnectAttempts})</span>
      </div>
    );
  }

  if (!status.connected) {
    return (
      <div className="mcp-status disconnected" title="MCP Server disconnected">
        <div className="mcp-dot" style={{ background: 'var(--red, #f87171)' }} />
        <span>MCP OFFLINE</span>
      </div>
    );
  }

  return (
    <div className="mcp-status connected" title={`MCP connected · uptime ${status.uptime}s`}>
      <div className={`mcp-dot ${blink ? 'on' : ''}`} style={{ background: 'var(--green)' }} />
      <span>MCP LIVE</span>
    </div>
  );
};
