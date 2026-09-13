import fs from "node:fs";
import path from "node:path";
import { exec, spawn } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface KokoCloneStatus {
  installed: boolean;
  venvReady: boolean;
  serverRunning: boolean;
  endpoint: string;
  kokoDir: string;
  pythonBin: string | null;
  message?: string;
}

export function getKokoclonePaths() {
  const cwd = process.cwd();
  const root = fs.existsSync(path.join(cwd, "kokoclone"))
    ? cwd
    : fs.existsSync(path.join(cwd, "..", "kokoclone"))
      ? path.resolve(cwd, "..")
      : cwd;

  const kokoDir = path.join(root, "kokoclone");
  const hasCode = fs.existsSync(path.join(kokoDir, "app.py"));

  const venvUnix = path.join(kokoDir, ".venv", "bin", "python");
  const venvWin = path.join(kokoDir, ".venv", "Scripts", "python.exe");
  const pythonBin = fs.existsSync(venvUnix) ? venvUnix : fs.existsSync(venvWin) ? venvWin : null;

  return {
    root,
    kokoDir,
    hasCode,
    hasVenv: Boolean(pythonBin),
    pythonBin,
  };
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function pythonBinMatchesPlatform(pythonBin: string | null): boolean {
  if (!pythonBin) return false;
  const normalized = pythonBin.replace(/\\/g, "/");
  const isWindowsVenv = /\/\.venv\/Scripts\/python\.exe$/i.test(normalized);
  const isUnixVenv = /\/\.venv\/bin\/python$/.test(normalized);
  if (process.platform === "win32") {
    return isWindowsVenv;
  }
  return isUnixVenv;
}

function readLogTail(logPath: string, maxChars = 2000): string {
  try {
    if (!fs.existsSync(logPath)) return "";
    const content = fs.readFileSync(logPath, "utf8");
    return content.slice(-maxChars).trim();
  } catch {
    return "";
  }
}

export async function checkKokoCloneStatus(endpoint: string = "http://127.0.0.1:7860"): Promise<KokoCloneStatus> {
  const cleanEndpoint = (endpoint || "http://127.0.0.1:7860").replace(/\/+$/, "");
  const paths = getKokoclonePaths();

  let serverRunning = false;
  try {
    const res = await fetch(`${cleanEndpoint}/`, { signal: AbortSignal.timeout(2500) });
    serverRunning = res.ok || res.status < 500;
  } catch {
    serverRunning = false;
  }

  let message = "KokoClone is ready.";
  if (!paths.hasCode) {
    message = "KokoClone submodule not downloaded yet.";
  } else if (!paths.hasVenv) {
    message = "KokoClone code found, but Python environment (.venv) is not created.";
  } else if (!serverRunning) {
    message = "KokoClone is installed but server is stopped.";
  } else {
    message = `KokoClone server is online and running at ${cleanEndpoint}.`;
  }

  return {
    installed: paths.hasCode,
    venvReady: paths.hasVenv,
    serverRunning,
    endpoint: cleanEndpoint,
    kokoDir: paths.kokoDir,
    pythonBin: paths.pythonBin,
    message,
  };
}

export async function setupKokoClone(): Promise<{ ok: boolean; message: string }> {
  const paths = getKokoclonePaths();

  // 1. Initialize git submodule if missing code
  if (!paths.hasCode) {
    try {
      await execAsync("git submodule update --init --recursive kokoclone", { cwd: paths.root });
    } catch {
      // Fallback: if kokoclone folder exists, restore working tree or pull
      if (fs.existsSync(paths.kokoDir)) {
        try {
          await execAsync("git restore --staged . && git restore .", { cwd: paths.kokoDir });
        } catch {
          try {
            await execAsync("git pull origin main", { cwd: paths.kokoDir });
          } catch (err) {
            return {
              ok: false,
              message: `Failed to initialize KokoClone repository: ${err instanceof Error ? err.message : String(err)}`,
            };
          }
        }
      } else {
        try {
          await execAsync("git clone https://github.com/C1ph3r404/kokoclone.git kokoclone", { cwd: paths.root });
        } catch (err) {
          return {
            ok: false,
            message: `Failed to download KokoClone repository: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      }
    }
  }

  // 2. Create venv if missing (or recreate if it was built for another OS,
  // e.g. Windows .venv/Scripts/python.exe while Node runs on Linux/WSL)
  let updatedPaths = getKokoclonePaths();
  if (updatedPaths.hasVenv && !pythonBinMatchesPlatform(updatedPaths.pythonBin)) {
    try {
      fs.rmSync(path.join(updatedPaths.kokoDir, ".venv"), { recursive: true, force: true });
    } catch {
      // best-effort; recreate below will surface errors
    }
    updatedPaths = getKokoclonePaths();
  }
  if (!updatedPaths.hasVenv) {
    try {
      // Try uv first for ultra fast installation (with seed packages like pip)
      await execAsync("uv venv --seed .venv", { cwd: updatedPaths.kokoDir });
    } catch {
      try {
        // python3 (macOS/Linux) → python (Windows/PATH) → py launcher (Windows).
        await execAsync("python3 -m venv .venv || python -m venv .venv || py -m venv .venv", { cwd: updatedPaths.kokoDir });
      } catch (err) {
        return {
          ok: false,
          message: `Failed to create virtual environment: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }
  }

  updatedPaths = getKokoclonePaths();
  if (!updatedPaths.pythonBin) {
    return {
      ok: false,
      message: "Python binary was not found in the virtual environment (.venv).",
    };
  }

  const pyBin = `"${updatedPaths.pythonBin}"`;
  const venvUv = process.platform === "win32"
    ? path.join(updatedPaths.kokoDir, ".venv", "Scripts", "uv.exe")
    : path.join(updatedPaths.kokoDir, ".venv", "bin", "uv");

  // Determine uv command (system uv, .venv uv, or bootstrap uv via pip)
  let uvCommand = "uv";
  let uvAvailable = false;
  try {
    await execAsync("uv --version");
    uvAvailable = true;
  } catch {
    if (fs.existsSync(venvUv)) {
      uvCommand = `"${venvUv}"`;
      uvAvailable = true;
    } else {
      // Try bootstrapping uv into .venv for full [tool.uv.sources] support
      try {
        await execAsync(`${pyBin} -m pip install uv`, { cwd: updatedPaths.kokoDir, maxBuffer: 10 * 1024 * 1024 });
        if (fs.existsSync(venvUv)) {
          uvCommand = `"${venvUv}"`;
          uvAvailable = true;
        }
      } catch {
        uvAvailable = false;
      }
    }
  }

  let installSuccess = false;

  // Strategy A: Use uv (natively resolves [tool.uv.sources] git packages like kanade-tokenizer)
  if (uvAvailable) {
    try {
      await execAsync(`${uvCommand} pip install --python ${pyBin} -e .`, {
        cwd: updatedPaths.kokoDir,
        maxBuffer: 15 * 1024 * 1024,
      });
      installSuccess = true;
    } catch {
      try {
        await execAsync(
          `${uvCommand} pip install --python ${pyBin} "torch>=2.1.0" "torchaudio>=2.1.0" "kokoro-onnx[gpu]>=0.5.0" "gradio>=6.8.0" "git+https://github.com/frothywater/kanade-tokenizer" soundfile huggingface_hub ninja setuptools "misaki[en,ja,zh]>=0.9.4"`,
          { cwd: updatedPaths.kokoDir, maxBuffer: 15 * 1024 * 1024 },
        );
        installSuccess = true;
      } catch {
        installSuccess = false;
      }
    }
  }

  // Strategy B: Fallback to standard pip (explicit git/zip for kanade-tokenizer, NEVER pip -e . without --no-deps)
  if (!installSuccess) {
    try {
      // 1. Install kanade-tokenizer directly (not on PyPI)
      try {
        await execAsync(`${pyBin} -m pip install "git+https://github.com/frothywater/kanade-tokenizer"`, {
          cwd: updatedPaths.kokoDir,
          maxBuffer: 15 * 1024 * 1024,
        });
      } catch {
        // Fallback to github zip archive if git binary is not found in PATH on Windows
        await execAsync(`${pyBin} -m pip install "https://github.com/frothywater/kanade-tokenizer/archive/refs/heads/main.zip"`, {
          cwd: updatedPaths.kokoDir,
          maxBuffer: 15 * 1024 * 1024,
        });
      }

      // 2. Install all core PyPI packages (kokoro-onnx, NOT the unrelated "kokoro" PyTorch package)
      await execAsync(
        `${pyBin} -m pip install "torch>=2.1.0" "torchaudio>=2.1.0" "kokoro-onnx[gpu]>=0.5.0" "gradio>=6.8.0" soundfile huggingface_hub ninja setuptools "misaki[en,ja,zh]>=0.9.4"`,
        { cwd: updatedPaths.kokoDir, maxBuffer: 15 * 1024 * 1024 },
      );

      // 3. Install requirements.txt if present
      if (fs.existsSync(path.join(updatedPaths.kokoDir, "requirements.txt"))) {
        await execAsync(`${pyBin} -m pip install -r requirements.txt`, {
          cwd: updatedPaths.kokoDir,
          maxBuffer: 15 * 1024 * 1024,
        });
      }

      // 4. Install kokoclone itself in editable mode without dependency resolution (so pip doesn't query PyPI for kanade-tokenizer)
      await execAsync(`${pyBin} -m pip install -e . --no-deps`, {
        cwd: updatedPaths.kokoDir,
        maxBuffer: 15 * 1024 * 1024,
      });

      installSuccess = true;
    } catch (err) {
      return {
        ok: false,
        message: `Failed to install KokoClone requirements: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // 3. Verify key imports so a half-installed venv fails fast with a clear message
  // (e.g. "kokoro" PyPI package is NOT "kokoro-onnx" — importing the wrong one hides the bug).
  try {
    await execAsync(`${pyBin} -c "import kokoro_onnx, gradio, kanade_tokenizer, misaki, soundfile"`, {
      cwd: updatedPaths.kokoDir,
      maxBuffer: 5 * 1024 * 1024,
    });
  } catch (err) {
    return {
      ok: false,
      message: `KokoClone dependencies are incomplete (missing kokoro-onnx or friends): ${err instanceof Error ? err.message : String(err)}. Click “Reinstall / Update Dependencies” again.`,
    };
  }

  // 4. Ensure model weights from PatnaikAshish/kokoclone are pre-downloaded
  const modelFile = path.join(updatedPaths.kokoDir, "model", "kokoro.onnx");
  const voiceFile = path.join(updatedPaths.kokoDir, "voice", "voices-v1.0.bin");
  if (!fs.existsSync(modelFile) || !fs.existsSync(voiceFile)) {
    try {
      await execAsync(
        `${pyBin} -c "from huggingface_hub import hf_hub_download; [hf_hub_download(repo_id='PatnaikAshish/kokoclone', filename=p, local_dir='.') for p in ['model/kokoro.onnx', 'model/config.json', 'voice/voices-v1.0.bin']]"`,
        { cwd: updatedPaths.kokoDir, maxBuffer: 30 * 1024 * 1024 },
      );
    } catch {
      // Cloner will attempt downloading during runtime if offline during setup
    }
  }

  return {
    ok: true,
    message: "KokoClone submodule, Python dependencies, and voice models are successfully installed and ready!",
  };
}

export async function startKokoCloneServer(endpoint: string = "http://127.0.0.1:7860"): Promise<{ ok: boolean; message: string }> {
  const status = await checkKokoCloneStatus(endpoint);
  if (status.serverRunning) {
    return { ok: true, message: `KokoClone is already running at ${status.endpoint}.` };
  }

  if (!status.installed) {
    return { ok: false, message: "KokoClone repository is not installed. Please set it up first." };
  }

  if (!status.venvReady || !status.pythonBin) {
    return { ok: false, message: "KokoClone Python environment (.venv) is not found. Please set it up first." };
  }

  // The venv must match the OS Node is running on. A Windows venv
  // (.venv/Scripts/python.exe) cannot be spawned from Linux/WSL and dies instantly.
  if (!pythonBinMatchesPlatform(status.pythonBin)) {
    return {
      ok: false,
      message:
        process.platform === "win32"
          ? "KokoClone .venv was created for Linux/macOS but the app runs on Windows. Click “Reinstall / Update Dependencies” to rebuild it."
          : "KokoClone .venv was created for Windows but the app server runs on Linux/WSL. Click “Reinstall / Update Dependencies” to rebuild it for Linux.",
    };
  }

  // Clean up a stale .server.pid left by a crashed process so stop/status stay accurate.
  const pidPath = path.join(status.kokoDir, ".server.pid");
  const logPath = path.join(status.kokoDir, "koko-server.log");
  try {
    if (fs.existsSync(pidPath)) {
      const pid = parseInt(fs.readFileSync(pidPath, "utf8").trim(), 10);
      if (Number.isNaN(pid) || !isPidAlive(pid)) {
        fs.unlinkSync(pidPath);
      }
    }
  } catch {
    // best-effort
  }

  let childPid: number | undefined;
  try {
    const logFd = fs.openSync(logPath, "a");
    fs.writeFileSync(logFd, `\n\n=== KokoClone launch ${new Date().toISOString()} ===\n`);
    const child = spawn(status.pythonBin, ["app.py"], {
      cwd: status.kokoDir,
      detached: true,
      stdio: ["ignore", logFd, logFd],
      windowsHide: true,
    });

    const spawnError = await new Promise<Error | null>((resolve) => {
      child.once("error", (err) => resolve(err instanceof Error ? err : new Error(String(err))));
      setImmediate(() => resolve(null));
    });
    if (spawnError) {
      try {
        fs.closeSync(logFd);
      } catch {
        // ignore
      }
      return {
        ok: false,
        message: `Failed to launch KokoClone server: ${spawnError.message}. See kokoclone/koko-server.log for details.`,
      };
    }

    childPid = child.pid;
    if (!childPid) {
      try {
        fs.closeSync(logFd);
      } catch {
        // ignore
      }
      const tail = readLogTail(logPath);
      return {
        ok: false,
        message: `Failed to launch KokoClone server (no process started).${tail ? ` Log: ${tail.slice(-500)}` : ""}`,
      };
    }

    try {
      fs.writeFileSync(pidPath, String(childPid), "utf8");
    } catch {
      // pid write is best-effort
    }

    child.unref();
    // Close our copy of the log fd in the parent; the child keeps its own.
    try {
      fs.closeSync(logFd);
    } catch {
      // ignore
    }

    let earlyExit: number | NodeJS.Signals | null = null;
    child.once("exit", (code, signal) => {
      earlyExit = code ?? signal ?? 0;
    });

    // Poll endpoint for up to 120 seconds (Kanade + Kokoro ONNX + vocoder load is slow).
    // Also bail out early if the child died so the UI doesn't flip back to "Stopped" silently.
    const cleanEndpoint = status.endpoint;
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      if (earlyExit !== null || child.exitCode !== null || child.signalCode !== null) {
        try {
          fs.unlinkSync(pidPath);
        } catch {
          // ignore
        }
        const tail = readLogTail(logPath);
        return {
          ok: false,
          message: `KokoClone server exited during startup (code ${child.exitCode ?? earlyExit ?? "?"}).${tail ? ` Last log lines: ${tail.slice(-800)}` : " See kokoclone/koko-server.log for details."}`,
        };
      }
      try {
        const res = await fetch(`${cleanEndpoint}/`, { signal: AbortSignal.timeout(1500) });
        if (res.ok || res.status < 500) {
          return { ok: true, message: `KokoClone server started successfully on ${cleanEndpoint} (PID ${childPid}).` };
        }
      } catch {
        // still starting up...
      }
    }

    // Still alive but HTTP not up after 120s — keep it running and let the UI keep polling.
    if (child.exitCode === null && childPid && isPidAlive(childPid)) {
      return {
        ok: true,
        message: `KokoClone server process launched (PID ${childPid}) but is still loading model weights. Wait ~1 minute then press Refresh. See kokoclone/koko-server.log for progress.`,
      };
    }

    try {
      fs.unlinkSync(pidPath);
    } catch {
      // ignore
    }
    const tail = readLogTail(logPath);
    return {
      ok: false,
      message: `KokoClone server process did not come online.${tail ? ` Last log lines: ${tail.slice(-800)}` : ""}`,
    };
  } catch (err) {
    // Don't leave a stale pid behind on failure.
    if (childPid) {
      try {
        fs.unlinkSync(pidPath);
      } catch {
        // ignore
      }
    }
    return {
      ok: false,
      message: `Failed to launch KokoClone server: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function stopKokoCloneServer(endpoint: string = "http://127.0.0.1:7860"): Promise<{ ok: boolean; message: string }> {
  const paths = getKokoclonePaths();
  const pidPath = path.join(paths.kokoDir, ".server.pid");
  let killed = false;

  // 1. Try stopping by tracked PID
  if (fs.existsSync(pidPath)) {
    try {
      const pidStr = fs.readFileSync(pidPath, "utf8").trim();
      const pid = parseInt(pidStr, 10);
      if (!Number.isNaN(pid) && pid > 0) {
        try {
          if (process.platform === "win32") {
            await execAsync(`taskkill /pid ${pid} /T /F`);
          } else if (isPidAlive(pid)) {
            process.kill(pid, "SIGTERM");
            await new Promise((r) => setTimeout(r, 2000));
            // Only escalate if the process survived SIGTERM (don't kill a PID that already exited).
            if (isPidAlive(pid)) {
              try {
                process.kill(pid, "SIGKILL");
              } catch {
                // process already exited
              }
            }
          }
          killed = true;
        } catch {
          // PID might have already stopped
        }
      }
      fs.unlinkSync(pidPath);
    } catch {
      // ignore unlink error
    }
  }

  // 2. If server was still running, kill process holding port 7860
  try {
    const url = new URL(endpoint || "http://127.0.0.1:7860");
    const port = url.port || "7860";
    if (process.platform === "win32") {
      try {
        const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
        const lines = stdout.split("\n").filter((l) => l.includes("LISTENING"));
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && /^\d+$/.test(pid)) {
            await execAsync(`taskkill /pid ${pid} /T /F`);
            killed = true;
          }
        }
      } catch {
        // netstat/taskkill fallback best-effort
      }
    } else {
      try {
        await execAsync(`fuser -k ${port}/tcp`);
        killed = true;
      } catch {
        // fuser fallback best-effort
      }
    }
  } catch {
    // endpoint parse error
  }

  const finalStatus = await checkKokoCloneStatus(endpoint);
  if (!finalStatus.serverRunning) {
    return { ok: true, message: killed ? "KokoClone server stopped successfully." : "KokoClone server is already stopped." };
  }

  return { ok: false, message: "KokoClone server process could not be terminated." };
}
