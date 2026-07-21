import React, { useEffect, useState } from "react";
import { AlertOctagon, X, ShieldAlert, KeyRound, CheckCircle2, Zap } from "lucide-react";

interface InterventionEvent {
  type: string;
  message: string;
  code: string;
  metadata?: Record<string, unknown>;
}

export default function AmbientIntervention() {
  const [isOpen, setIsOpen] = useState(false);
  const [eventData, setEventData] = useState<InterventionEvent | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handleIntervention = (e: Event) => {
      const customEvent = e as CustomEvent<InterventionEvent>;
      if (["MISSING_KEY", "QUARANTINE", "PAYMENT_REQUIRED"].includes(customEvent.detail.type)) {
        setEventData(customEvent.detail);
        setIsOpen(true);
      }
    };

    window.addEventListener("AmbientIntervention", handleIntervention);
    return () => window.removeEventListener("AmbientIntervention", handleIntervention);
  }, []);

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let resolutionData: Record<string, unknown> = {};
      if (eventData?.type === "MISSING_KEY") {
        resolutionData = { api_key: apiKey };
      } else if (eventData?.type === "QUARANTINE") {
        resolutionData = { approved: true };
      } else if (eventData?.type === "PAYMENT_REQUIRED") {
        resolutionData = { vnp_injected: 15.0 };
      }

      window.dispatchEvent(
        new CustomEvent("AmbientInterventionResolved", {
          detail: {
            originalEvent: eventData,
            resolution: resolutionData,
          },
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 300));
      setIsOpen(false);
      setApiKey("");
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

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

  return (
    <div
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
      {/* Backdrop */}
      <div
        onClick={() => setIsOpen(false)}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(8px)",
        }}
      />

      {/* Modal */}
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
        {/* Close */}
        <button
          onClick={() => setIsOpen(false)}
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
          <X size={18} />
        </button>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
          <div
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
            ) : (
              <ShieldAlert size={24} />
            )}
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "#fff", margin: 0 }}>
              {eventData?.type === "QUARANTINE"
                ? "Safety Layer Quarantine"
                : eventData?.type === "PAYMENT_REQUIRED"
                  ? "VNP Micro-Stake Required"
                  : "Ambient Intervention"}
            </h2>
            <p style={{ fontSize: 13, color: accentColor, margin: "2px 0 0" }}>
              Terminal Edge Node
            </p>
          </div>
        </div>

        {/* Description */}
        <div
          style={{
            marginBottom: 24,
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
          {eventData?.type === "QUARANTINE" &&
            "A critical anomaly was detected in this agent\u2019s behavior. The capability execution has been quarantined and requires M-of-N human approval."}
          {eventData?.type === "PAYMENT_REQUIRED" &&
            "Agent workload exceeds allocated budget constraints. x402 Payment Required. Inject VNP Micro-Stakes to unblock."}
          {eventData?.type === "MISSING_KEY" &&
            "Your task requires a Bring-Your-Own-Key (BYOK) credential that is currently missing from your Sovereign Identity."}
          {eventData?.message && (
            <p
              style={{
                fontFamily: "monospace",
                fontSize: 11,
                color: "rgba(244,63,94,0.7)",
                marginTop: 8,
              }}
            >
              {eventData.code}: {eventData.message}
            </p>
          )}
        </div>

        {/* MISSING_KEY form */}
        {eventData?.type === "MISSING_KEY" && (
          <form onSubmit={handleAction}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                fontWeight: 500,
                color: "rgba(255,255,255,0.85)",
                marginBottom: 8,
              }}
            >
              <KeyRound size={16} style={{ color: "#6366F1" }} />
              Provider API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoFocus
              style={{
                width: "100%",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(0,0,0,0.5)",
                padding: "10px 16px",
                color: "#fff",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 16 }}>
              <button
                type="submit"
                style={{
                  borderRadius: 10,
                  background: "#4F46E5",
                  padding: "10px 24px",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {isSubmitting ? "Processing\u2026" : "Inject Credential"}
              </button>
            </div>
          </form>
        )}

        {/* QUARANTINE approval */}
        {eventData?.type === "QUARANTINE" && (
          <div>
            <div
              style={{
                borderRadius: 10,
                border: "1px solid rgba(245,158,11,0.15)",
                background: "rgba(245,158,11,0.04)",
                padding: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "rgba(255,255,255,0.4)",
                  }}
                >
                  Quorum Status
                </span>
                <span style={{ fontSize: 11, fontFamily: "monospace", color: "#F59E0B" }}>
                  0 / {(eventData?.metadata?.required_count as number) || 2} Approvals
                </span>
              </div>
              <div
                style={{
                  width: "100%",
                  background: "rgba(0,0,0,0.5)",
                  height: 6,
                  borderRadius: 999,
                  overflow: "hidden",
                }}
              >
                <div style={{ background: "#F59E0B", height: "100%", width: "0%" }} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 16 }}>
              <button
                type="button"
                onClick={handleAction}
                style={{
                  borderRadius: 10,
                  background: "#D97706",
                  padding: "10px 24px",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <CheckCircle2 size={16} /> Provide Signature
              </button>
            </div>
          </div>
        )}

        {/* PAYMENT_REQUIRED stake injection */}
        {eventData?.type === "PAYMENT_REQUIRED" && (
          <div>
            <div
              style={{
                borderRadius: 10,
                border: "1px solid rgba(16,185,129,0.15)",
                background: "rgba(16,185,129,0.04)",
                padding: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
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
                  Required Stake
                </div>
                <div style={{ fontSize: 18, fontFamily: "monospace", color: "#10B981" }}>15.00 VNP</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "rgba(255,255,255,0.4)",
                    marginBottom: 4,
                  }}
                >
                  Available
                </div>
                <div style={{ fontSize: 18, fontFamily: "monospace", color: "rgba(255,255,255,0.6)" }}>
                  45.00 VNP
                </div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 16 }}>
              <button
                type="button"
                onClick={handleAction}
                style={{
                  borderRadius: 10,
                  background: "#059669",
                  padding: "10px 24px",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Zap size={16} /> Inject Stake
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
