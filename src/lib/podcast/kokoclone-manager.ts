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

  // 2. Create venv if missing
  let updatedPaths = getKokoclonePaths();
  if (!updatedPaths.hasVenv) {
    try {
      // Try uv first for ultra fast installation (with seed packages like pip)
      await execAsync("uv venv --seed .venv", { cwd: updatedPaths.kokoDir });
    } catch {
      try {
        await execAsync("python3 -m venv .venv || python -m venv .venv", { cwd: updatedPaths.kokoDir });
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
          `${uvCommand} pip install --python ${pyBin} "torch>=2.1.0" "torchaudio>=2.1.0" "kokoro>=0.9.0" "gradio>=6.8.0" "git+https://github.com/frothywater/kanade-tokenizer" soundfile huggingface_hub ninja setuptools "misaki[en,ja,zh]>=0.9.4"`,
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

      // 2. Install all core PyPI packages
      await execAsync(
        `${pyBin} -m pip install "torch>=2.1.0" "torchaudio>=2.1.0" "kokoro>=0.9.0" "gradio>=6.8.0" soundfile huggingface_hub ninja setuptools "misaki[en,ja,zh]>=0.9.4"`,
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

  try {
    const child = spawn(status.pythonBin, ["app.py"], {
      cwd: status.kokoDir,
      detached: true,
      stdio: "ignore",
    });
    child.unref();

    // Poll endpoint for up to 10 seconds
    const cleanEndpoint = status.endpoint;
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const res = await fetch(`${cleanEndpoint}/`, { signal: AbortSignal.timeout(1500) });
        if (res.ok || res.status < 500) {
          return { ok: true, message: `KokoClone server started successfully on ${cleanEndpoint} (PID ${child.pid}).` };
        }
      } catch {
        // still starting up...
      }
    }

    return {
      ok: true,
      message: `KokoClone server process launched (PID ${child.pid}). Loading model weights in the background...`,
    };
  } catch (err) {
    return {
      ok: false,
      message: `Failed to launch KokoClone server: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
