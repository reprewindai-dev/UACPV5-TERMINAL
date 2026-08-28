import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CANONICAL_PORT = 80;
const FORBIDDEN_PORTS = new Set([3000, 8000]);

export function resolveRuntimePort(rawPort = process.env.PORT, nodeEnv = process.env.NODE_ENV) {
  const portText = rawPort == null ? "" : String(rawPort).trim();
  if (portText !== "" && !/^\d+$/.test(portText)) {
    throw new Error(`PORT must be an integer between 1 and 65535; received ${rawPort}`);
  }

  const resolved = portText === "" ? CANONICAL_PORT : Number(portText);

  if (!Number.isInteger(resolved) || resolved < 1 || resolved > 65535) {
    throw new Error(`PORT must be an integer between 1 and 65535; received ${rawPort}`);
  }
  if (FORBIDDEN_PORTS.has(resolved)) {
    throw new Error(`PORT ${resolved} is forbidden for canonical Terminal; use ${CANONICAL_PORT}`);
  }
  if (nodeEnv === "production" && resolved !== CANONICAL_PORT) {
    throw new Error(`Production Terminal must listen on canonical port ${CANONICAL_PORT}; received ${resolved}`);
  }

  return resolved;
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  try {
    if (process.argv.includes("--production")) {
      process.env.NODE_ENV = "production";
    }

    const port = resolveRuntimePort();
    process.env.PORT = String(port);

    if (process.argv.includes("--check")) {
      console.log(`Terminal runtime port check passed: ${port}`);
      process.exit(0);
    }

    const separator = process.argv.indexOf("--");
    const commandArgs = separator >= 0 ? process.argv.slice(separator + 1) : [];
    const [command, ...args] = commandArgs;
    if (!command) {
      throw new Error("No server command supplied after --");
    }

    const child = spawn(command, args, {
      stdio: "inherit",
      env: process.env,
      shell: process.platform === "win32",
    });

    child.on("exit", (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }
      process.exit(code ?? 1);
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
