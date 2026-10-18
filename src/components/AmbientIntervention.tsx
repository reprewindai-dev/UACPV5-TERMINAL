import React, { useEffect, useState } from "react";
import { AlertOctagon, KeyRound, ShieldAlert, X, Zap } from "lucide-react";

interface InterventionEvent {
  type: string;
  message: string;
  code: string;
  metadata?: Record<string, unknown>;
}

function interventionCopy(type: string | undefined): string {
  if (type === "QUARANTINE") {
    return (
      "This Terminal surface cannot approve or release a quarantine. A governed backend must collect, " +
      "validate, and bind the required approval quorum to the blocked execution. Until that authority is " +
      "available and verified, execution remains blocked."
    );
  }

  if (type === "PAYMENT_REQUIRED") {
    return (
      "This Terminal surface cannot create or confirm settlement. Payment must be completed and verified " +
      "through the governed settlement path before execution can continue. Until verified settlement " +
      "evidence exists, execution remains blocked."
    );
  }

  return (
    "Credential submission is unavailable in this browser surface. Configure provider credentials through " +
    "an authenticated backend or secret-management flow. This UI does not broadcast provider keys through " +
    "browser events."
  );
}

export default function AmbientIntervention() {
  const [isOpen, setIsOpen] = useState(false);
  const [eventData, setEventData] = useState<InterventionEvent | null>(null);

  useEffect(() => {
    const handleIntervention = (event: Event) => {
      const customEvent = event as CustomEvent<InterventionEvent>;
      if (["MISSING_KEY", "QUARANTINE", "PAYMENT_REQUIRED"].includes(customEvent.detail.type)) {
        setEventData(customEvent.detail);
        setIsOpen(true);
      }
    };

    window.addEventListener("AmbientIntervention", handleIntervention);
    return () => window.removeEventListener("AmbientIntervention", handleIntervention);
  }, []);

  if (!isOpen) return null;

  const glowColor =
    eventData?.type === "QUARANTINE"
      ? "rgba(245,158,11,0.15)"
      : eventData?.type === "PAYMENT_REQUIRED"
        ? "rgba(16,185,129,0.15)"
        : "rgba(99,102,241,0.15)";

  const accentColor =
    eventData?.type === "QUARANTINE"
      ? "#F59E0B"
      : eventData?.type === "PAYMENT_REQUIRED"
        ? "#10B981"
        : "#6366F1";

  const statusLabel = eventData?.type === "MISSING_KEY" ? "UNAVAILABLE" : "NOT_VERIFIED";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ambient-intervention-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        aria-hidden="true"
        onClick={() => setIsOpen(false)}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(8px)",
        }}
      />

      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 520,
          overflow: "hidden",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "#0a0a0c",
          padding: 32,
          boxShadow: `0 0 80px ${glowColor}, 0 24px 48px rgba(0,0,0,0.6)`,
        }}
      >
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label="Close intervention"
          style={{
            position: "absolute",
            right: 16,
            top: 16,
            background: "transparent",
            border: "none",
            color: "rgba(255,255,255,0.4)",
            cursor: "pointer",
            borderRadius: "50%",
            padding: 6,
          }}
        >
          <X size={18} aria-hidden="true" />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
          <div
            aria-hidden="true"
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              border: `1px solid ${accentColor}33`,
              background: `${accentColor}15`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: accentColor,
            }}
          >
            {eventData?.type === "QUARANTINE" ? (
              <AlertOctagon size={24} />
            ) : eventData?.type === "PAYMENT_REQUIRED" ? (
              <Zap size={24} />
            ) : eventData?.type === "MISSING_KEY" ? (
              <KeyRound size={24} />
            ) : (
              <ShieldAlert size={24} />
            )}
          </div>
          <div>
            <h2 id="ambient-intervention-title" style={{ fontSize: 18, fontWeight: 600, color: "#fff", margin: 0 }}>
              {eventData?.type === "QUARANTINE"
                ? "Safety Layer Quarantine"
                : eventData?.type === "PAYMENT_REQUIRED"
                  ? "Payment Required"
                  : "Credential Required"}
            </h2>
            <p style={{ fontSize: 13, color: accentColor, margin: "2px 0 0" }}>Terminal Edge Node</p>
          </div>
        </div>

        <div
          style={{
            marginBottom: 16,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.05)",
            background: "rgba(255,255,255,0.03)",
            padding: 16,
            fontSize: 13,
            color: "rgba(255,255,255,0.75)",
            lineHeight: 1.5,
          }}
        >
          <span style={{ fontWeight: 600, color: "#fff" }}>Execution Blocked: </span>
          {interventionCopy(eventData?.type)}
          {eventData?.message && (
            <p
              style={{
                fontFamily: "monospace",
                fontSize: 11,
                color: "rgba(244,63,94,0.7)",
                marginTop: 8,
                marginBottom: 0,
              }}
            >
              {eventData.code}: {eventData.message}
            </p>
          )}
        </div>

        <div
          style={{
            borderRadius: 10,
            border: `1px solid ${accentColor}33`,
            background: `${accentColor}0A`,
            padding: 16,
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "rgba(255,255,255,0.4)",
                marginBottom: 4,
              }}
            >
              Resolution State
            </div>
            <div style={{ fontSize: 13, fontFamily: "monospace", color: accentColor }}>{statusLabel}</div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            style={{
              borderRadius: 10,
              background: "rgba(255,255,255,0.08)",
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 500,
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.1)",
              cursor: "pointer",
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
