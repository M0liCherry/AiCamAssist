"use client";

import { ArrowLeft, Check, CheckCircle2, ChevronLeft, ChevronRight, Circle, Cloud, Download, Eye, EyeOff, Gauge, Headphones, Layers, ListChecks, Music, Pause, Play, Radio, RefreshCw, RotateCcw, SkipBack, SkipForward, Sparkles, Square, SquareStack, Trophy, Upload, Volume2, Wand2, WandSparkles, XCircle } from "lucide-react";
import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, errorMessage, formatClock, formatDate } from "./client";
import { DEFAULT_KOKO_ENDPOINT } from "@/config/app";
import { buildPersonalizationPrompt, getStoredPersonalization, LEARNING_STYLE_DESCRIPTIONS, PERSONA_DESCRIPTIONS } from "./personalization";
import { saveFlashcardSessionScore, saveQuizAttemptScore } from "./studyScores";
import type { Asset, AssetResponse, CardProgress, FlashcardDeck, PodcastScript, QuizAttempt, QuizPayload, Scope, Subject } from "./types";
import { AiErrorAlert, InlineAlert, Modal, renderInline, ScopeBar, Spinner, StatusPill } from "./ui";

type StudyProps = {
  subjects: Subject[];
  scope: Scope | null;
  onScope: (scope: Scope) => void;
  scopeTitle: string;
  aiReady: boolean;
  providerName: string;
  onConfigureAi: () => void;
  onGoHub: () => void;
  notify: (text: string, tone?: "success" | "info" | "error") => void;
};

function useAsset<T>(kind: "podcast" | "flashcards" | "quiz", scope: Scope | null) {
  const [data, setData] = useState<AssetResponse<T> | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const lastOptions = useRef<Record<string, unknown> | null>(null);
  useEffect(() => {
    if (!scope) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api<AssetResponse<T>>(`/api/generate?scopeType=${scope.scopeType}&scopeId=${scope.scopeId}&kind=${kind}`)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scope, kind]);
  const generate = useCallback(
    async (options: Record<string, unknown>) => {
      if (!scope) return;
      lastOptions.current = options;
      setGenerating(true);
      setError(null);
      try {
        setData(await api<AssetResponse<T>>("/api/generate", { method: "POST", json: { scopeType: scope.scopeType, scopeId: scope.scopeId, kind, personalization: buildPersonalizationPrompt(getStoredPersonalization()), ...options } }));
      } catch (err) {
        setError(err);
      } finally {
        setGenerating(false);
      }
    },
    [scope, kind],
  );
  /** Re-runs the last generation (used after switching to a recommended model). */
  const retry = useCallback(() => {
    if (lastOptions.current) void generate(lastOptions.current);
  }, [generate]);
  return { data, setData, loading, generating, error, generate, retry };
}

function StudyShell({ props, icon, eyebrow, title, copy, children, ariaId }: { props: StudyProps; icon: ReactNode; eyebrow: string; title: string; copy: string; children: ReactNode; ariaId: string }) {
  const { subjects, scope, onScope, aiReady, providerName, onConfigureAi, onGoHub } = props;
  return (
    <main className="study-view page-enter" aria-labelledby={ariaId}>
      <header className="study-header">
        <span className="study-icon" aria-hidden="true">{icon}</span>
        <p className="eyebrow">{eyebrow}</p>
        <h1 id={ariaId}>{title}</h1>
        <p>{copy}</p>
      </header>
      {!subjects.length ? (
        <div className="zero-state">
          <h2>Nothing to study yet</h2>
          <p>Create a subject and import notes in the Notes hub first. Generated material is built only from your own notes.</p>
          <button type="button" className="primary-button" onClick={onGoHub}><ArrowLeft size={15} aria-hidden="true" />Go to Notes hub</button>
        </div>
      ) : (
        <>
          <ScopeBar subjects={subjects} scope={scope} onScope={onScope} trailing={aiReady ? <span className="scope-ai"><Sparkles size={13} aria-hidden="true" />{providerName}</span> : <button type="button" className="secondary-button compact" onClick={onConfigureAi}><Sparkles size={14} aria-hidden="true" />Set up AI backend</button>} />
          {children}
        </>
      )}
    </main>
  );
}

function GenerationNotice({ asset, generating, providerName, label }: { asset: Asset<unknown> | null; generating: boolean; providerName: string; label: string }) {
  if (generating) return <p className="gen-status" role="status"><Spinner label={`Generating ${label} with ${providerName}… local models can take a minute or two.`} /></p>;
  if (!asset) return null;
  return <p className="gen-status">Generated {formatDate(asset.createdAt)} from {asset.sourceNoteCount} note{asset.sourceNoteCount === 1 ? "" : "s"} with {String(asset.options.model ?? providerName)}{asset.options.truncated ? " · long notes were sampled to fit the model context" : ""}.</p>;
}

/* ---------------------------------- Podcasts --------------------------------- */

export function PodcastsView(props: StudyProps) {
  const { scope, aiReady, providerName, onConfigureAi } = props;
  const { data, setData, loading, generating, error, generate, retry } = useAsset<PodcastScript>("podcast", scope);
  const [length, setLength] = useState<"short" | "medium" | "long">("short");
  const [playing, setPlaying] = useState(false);
  const [turn, setTurn] = useState(0);
  const [wordIndex, setWordIndex] = useState(-1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [hostVoice, setHostVoice] = useState("");
  const [guestVoice, setGuestVoice] = useState("");
  const [rate, setRate] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const script = data?.asset?.payload ?? null;
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const playingRef = useRef(false);

  // Audio Engine & Custom Voice States
  const [engine, setEngine] = useState<"speechSynthesis" | "elevenlabs" | "kokoclone">("speechSynthesis");
  const [hasElevenKey, setHasElevenKey] = useState(false);
  const [inlineElevenKey, setInlineElevenKey] = useState("");
  const [showInlineElevenKey, setShowInlineElevenKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [keySavedMessage, setKeySavedMessage] = useState<string | null>(null);

  const [elevenHostVoice, setElevenHostVoice] = useState("21m00Tcm4TlvDq8ikWAM");
  const [elevenGuestVoice, setElevenGuestVoice] = useState("pNInz6obpgDQGcFmaJgB");
  const [elevenVoices, setElevenVoices] = useState<Array<{ id: string; name: string; category?: string; description?: string }>>([]);

  const [kokoEndpoint, setKokoEndpoint] = useState(DEFAULT_KOKO_ENDPOINT);
  const [kokoOnline, setKokoOnline] = useState<boolean | null>(null);
  const [hostRefAudio, setHostRefAudio] = useState<string | null>(null);
  const [guestRefAudio, setGuestRefAudio] = useState<string | null>(null);
  const [hostRefName, setHostRefName] = useState<string>("");
  const [guestRefName, setGuestRefName] = useState<string>("");

  const [designingVoice, setDesigningVoice] = useState<"host" | "guest" | null>(null);
  const [synthesizing, setSynthesizing] = useState(false);
  const [synthesisError, setSynthesisError] = useState<string | null>(null);
  const [realAudioDuration, setRealAudioDuration] = useState<number>(0);

  // Continuous turn generation states
  const [generatingTurnIndex, setGeneratingTurnIndex] = useState<number | null>(null);
  const [isGeneratingContinuously, setIsGeneratingContinuously] = useState(false);
  const isGeneratingContinuouslyRef = useRef(false);
  const stopGenerationRef = useRef(false);
  const [waitingForTurn, setWaitingForTurn] = useState<number | null>(null);

  const completedTurnsCount = useMemo(() => {
    if (!script?.turns?.length) return 0;
    return script.turns.filter((t) => Boolean(t.audioUrl)).length;
  }, [script?.turns]);

  // Load user settings on mount
  useEffect(() => {
    api<{ settings: any }>("/api/settings")
      .then((res) => {
        if (res?.settings) {
          setHasElevenKey(Boolean(res.settings.hasElevenLabsKey));
          if (res.settings.podcastAudioEngine) setEngine(res.settings.podcastAudioEngine);
          if (res.settings.elevenLabsHostVoice) setElevenHostVoice(res.settings.elevenLabsHostVoice);
          if (res.settings.elevenLabsGuestVoice) setElevenGuestVoice(res.settings.elevenLabsGuestVoice);
          if (res.settings.kokoCloneEndpoint) setKokoEndpoint(res.settings.kokoCloneEndpoint);
        }
      })
      .catch(() => {});

    api<{ voices: Array<any>; kokoStatus?: { running: boolean } }>("/api/podcast/voices?checkKokoClone=1")
      .then((res) => {
        if (res?.voices?.length) setElevenVoices(res.voices);
        if (res?.kokoStatus) setKokoOnline(res.kokoStatus.running);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!supported) return;
    const load = () => {
      const list = window.speechSynthesis.getVoices();
      setVoices(list);
      const english = list.filter((v) => v.lang.toLowerCase().startsWith("en"));
      const pool = english.length ? english : list;
      setHostVoice((current) => current || pool[0]?.name || "");
      setGuestVoice((current) => current || pool.find((v) => v.name !== pool[0]?.name)?.name || pool[0]?.name || "");
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
      window.speechSynthesis.cancel();
    };
  }, [supported]);

  const turnDurations = useMemo(() => {
    if (!script) return [];
    return script.turns.map((t) => Math.max(2, Math.round(t.text.split(/\s+/).length / (2.5 * rate))));
  }, [script, rate]);

  const turnStarts = useMemo(() => {
    let curr = 0;
    return turnDurations.map((d) => {
      const s = curr;
      curr += d;
      return s;
    });
  }, [turnDurations]);

  const totalDuration = useMemo(() => {
    if (script?.audioUrl && realAudioDuration > 0) return Math.round(realAudioDuration);
    return turnDurations.reduce((a, b) => a + b, 0);
  }, [script?.audioUrl, realAudioDuration, turnDurations]);

  useEffect(() => {
    setTurn(0);
    setWordIndex(-1);
    setCurrentTime(0);
    if (audioRef.current) {
      try {
        audioRef.current.currentTime = 0;
        audioRef.current.pause();
      } catch {}
    }
    setPlaying(false);
    playingRef.current = false;
    if (supported) window.speechSynthesis.cancel();
  }, [data?.asset?.id, supported]);

  const speak = useCallback(
    (index: number) => {
      if (!script || !supported) return;
      window.speechSynthesis.cancel();
      const current = script.turns[index];
      if (!current) {
        setPlaying(false);
        playingRef.current = false;
        return;
      }
      const utterance = new SpeechSynthesisUtterance(current.text);
      const voice = voices.find((v) => v.name === (current.speaker === "host" ? hostVoice : guestVoice));
      if (voice) utterance.voice = voice;
      utterance.rate = rate;
      utterance.pitch = current.speaker === "host" ? 1 : 0.92;
      const words = current.text.split(/\s+/);
      let offset = 0;
      const starts = words.map((word) => {
        const start = current.text.indexOf(word, offset);
        offset = start + word.length;
        return start;
      });
      utterance.onboundary = (event) => {
        if (event.name && event.name !== "word") return;
        let found = 0;
        for (let i = 0; i < starts.length; i++) if (starts[i] <= event.charIndex) found = i;
        setWordIndex(found);
      };
      utterance.onstart = () => {
        setTurn(index);
        setWordIndex(0);
        const startTime = turnStarts[index] ?? 0;
        setCurrentTime(startTime);
        setPlaying(true);
        playingRef.current = true;
      };
      utterance.onend = () => {
        if (!playingRef.current) return;
        if (index < script.turns.length - 1) speak(index + 1);
        else {
          setPlaying(false);
          playingRef.current = false;
          setWordIndex(-1);
          setCurrentTime(totalDuration);
        }
      };
      utterance.onerror = () => {
        setPlaying(false);
        playingRef.current = false;
      };
      window.speechSynthesis.speak(utterance);
    },
    [script, supported, voices, hostVoice, guestVoice, rate, turnStarts, totalDuration],
  );

  const playTurnAudio = useCallback(
    (index: number) => {
      if (!script || !script.turns[index]) return;
      const targetTurn = script.turns[index];
      setTurn(index);
      setWordIndex(-1);

      if (supported) window.speechSynthesis.cancel();

      if (targetTurn.audioUrl && audioRef.current) {
        audioRef.current.src = targetTurn.audioUrl;
        audioRef.current.currentTime = 0;
        audioRef.current
          .play()
          .then(() => {
            setPlaying(true);
            playingRef.current = true;
          })
          .catch(() => {});
        return;
      }

      if (engine === "speechSynthesis") {
        speak(index);
      }
    },
    [script, supported, speak, engine],
  );

  useEffect(() => {
    if (waitingForTurn !== null && script?.turns[waitingForTurn]?.audioUrl) {
      const turnToPlay = waitingForTurn;
      setWaitingForTurn(null);
      playTurnAudio(turnToPlay);
    }
  }, [script, waitingForTurn, playTurnAudio]);

  // Time tracker for synthetic speech mode
  useEffect(() => {
    if (!playing || script?.audioUrl) return;
    const interval = window.setInterval(() => {
      setCurrentTime((prev) => {
        const turnStart = turnStarts[turn] ?? 0;
        const turnDur = turnDurations[turn] ?? 3;
        const next = prev + 0.25;
        if (next <= turnStart + turnDur) {
          return next;
        }
        return prev;
      });
    }, 250);
    return () => window.clearInterval(interval);
  }, [playing, turn, turnStarts, turnDurations, script?.audioUrl]);

  const toggle = () => {
    if (audioRef.current && (script?.turns[turn]?.audioUrl || script?.audioUrl)) {
      if (playing) {
        audioRef.current.pause();
        setPlaying(false);
        playingRef.current = false;
      } else {
        if (!audioRef.current.src && script.turns[turn]?.audioUrl) {
          audioRef.current.src = script.turns[turn].audioUrl;
        }
        audioRef.current.play().catch(() => {});
        setPlaying(true);
        playingRef.current = true;
      }
      return;
    }

    if (!supported) return;
    if (playing) {
      playingRef.current = false;
      window.speechSynthesis.cancel();
      setPlaying(false);
    } else speak(turn);
  };

  const jump = (index: number) => {
    if (!script) return;
    const next = Math.max(0, Math.min(script.turns.length - 1, index));
    setTurn(next);
    setWordIndex(-1);

    if (script.turns[next]?.audioUrl) {
      playTurnAudio(next);
      return;
    }

    const time = turnStarts[next] ?? 0;
    setCurrentTime(time);

    if (playing) speak(next);
  };

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement> | React.FormEvent<HTMLInputElement>) => {
    const targetSec = Number(event.currentTarget.value);
    setCurrentTime(targetSec);

    if (script?.audioUrl && audioRef.current) {
      try {
        audioRef.current.currentTime = targetSec;
      } catch {}
    }

    if (!script || !turnStarts.length) return;
    let foundTurn = 0;
    for (let i = 0; i < turnStarts.length; i++) {
      if (turnStarts[i] <= targetSec) foundTurn = i;
      else break;
    }
    setTurn(foundTurn);
    setWordIndex(-1);

    if (playingRef.current && (!script?.audioUrl || !audioRef.current)) {
      speak(foundTurn);
    }
  };

  const handleRateChange = (selectedRate: number) => {
    setRate(selectedRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = selectedRate;
    }
    if (playingRef.current && !script?.audioUrl) {
      speak(turn);
    }
  };

  const onLengthKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const options = ["short", "medium", "long"] as const;
    const next = options[(index + (event.key === "ArrowRight" ? 1 : options.length - 1)) % options.length];
    setLength(next);
    document.getElementById(`length-${next}`)?.focus();
  };

  const onPlayerKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      toggle();
    }
    if (event.key === "ArrowRight") jump(turn + 1);
    if (event.key === "ArrowLeft") jump(turn - 1);
  };

  // Continuous turn-by-turn generation for instant, uninterrupted playback
  const startContinuousGeneration = async () => {
    if (!data?.asset?.id || !script?.turns?.length) return;
    stopGenerationRef.current = false;
    isGeneratingContinuouslyRef.current = true;
    setIsGeneratingContinuously(true);
    setSynthesizing(true);
    setSynthesisError(null);

    try {
      for (let i = 0; i < script.turns.length; i++) {
        if (stopGenerationRef.current) {
          props.notify("Continuous generation stopped.", "info");
          break;
        }

        // If turn i already has audio, skip to next
        if (script.turns[i]?.audioUrl) {
          continue;
        }

        setGeneratingTurnIndex(i);

        const res = await api<{ audioUrl: string; turns: Array<any> }>("/api/podcast/audio", {
          method: "POST",
          json: {
            assetId: data.asset.id,
            engine,
            apiKey: inlineElevenKey.trim() || undefined,
            hostVoice: elevenHostVoice,
            guestVoice: elevenGuestVoice,
            kokoCloneEndpoint: kokoEndpoint,
            hostRefAudio: hostRefAudio,
            guestRefAudio: guestRefAudio,
            startTurn: i,
            endTurn: i + 1,
          },
        });

        setData((prev) => {
          if (!prev || !prev.asset) return prev;
          return {
            ...prev,
            asset: {
              ...prev.asset,
              payload: {
                ...prev.asset.payload,
                audioUrl: res.audioUrl,
                turns: res.turns,
                audioEngine: engine,
              },
            },
          };
        });

        // The instant the first turn is generated, auto-play immediately so playback begins with zero wait!
        if (i === 0 || (!playingRef.current && turn === i)) {
          if (res.turns[i]?.audioUrl && audioRef.current) {
            audioRef.current.src = res.turns[i].audioUrl;
            audioRef.current.currentTime = 0;
            audioRef.current
              .play()
              .then(() => {
                setPlaying(true);
                playingRef.current = true;
              })
              .catch(() => {});
          }
        }
      }

      if (!stopGenerationRef.current) {
        props.notify("All turns generated and stitched continuously!", "success");
      }
    } catch (err) {
      setSynthesisError(errorMessage(err));
    } finally {
      setIsGeneratingContinuously(false);
      isGeneratingContinuouslyRef.current = false;
      setGeneratingTurnIndex(null);
      setSynthesizing(false);
    }
  };

  const stopGeneratingContinuously = () => {
    stopGenerationRef.current = true;
    isGeneratingContinuouslyRef.current = false;
    setIsGeneratingContinuously(false);
    setGeneratingTurnIndex(null);
    setSynthesizing(false);
  };

  const generateSingleTurn = async (index: number) => {
    if (!data?.asset?.id || !script?.turns?.length) return;
    setGeneratingTurnIndex(index);
    setSynthesisError(null);

    try {
      const res = await api<{ audioUrl: string; turns: Array<any> }>("/api/podcast/audio", {
        method: "POST",
        json: {
          assetId: data.asset.id,
          engine,
          apiKey: inlineElevenKey.trim() || undefined,
          hostVoice: elevenHostVoice,
          guestVoice: elevenGuestVoice,
          kokoCloneEndpoint: kokoEndpoint,
          hostRefAudio: hostRefAudio,
          guestRefAudio: guestRefAudio,
          startTurn: index,
          endTurn: index + 1,
        },
      });

      setData((prev) => {
        if (!prev || !prev.asset) return prev;
        return {
          ...prev,
          asset: {
            ...prev.asset,
            payload: {
              ...prev.asset.payload,
              audioUrl: res.audioUrl,
              turns: res.turns,
              audioEngine: engine,
            },
          },
        };
      });

      props.notify(`Turn ${index + 1} generated!`, "success");
    } catch (err) {
      setSynthesisError(errorMessage(err));
    } finally {
      setGeneratingTurnIndex(null);
    }
  };

  // Generate audio entrypoint
  const generateStudioAudio = async () => {
    if (engine === "kokoclone") {
      await startContinuousGeneration();
      return;
    }

    if (!data?.asset?.id) return;
    setSynthesizing(true);
    setSynthesisError(null);

    try {
      const res = await api<{ audioUrl: string; turns: Array<any> }>("/api/podcast/audio", {
        method: "POST",
        json: {
          assetId: data.asset.id,
          engine,
          apiKey: inlineElevenKey.trim() || undefined,
          hostVoice: elevenHostVoice,
          guestVoice: elevenGuestVoice,
          kokoCloneEndpoint: kokoEndpoint,
          hostRefAudio: hostRefAudio,
          guestRefAudio: guestRefAudio,
        },
      });

      setData((prev) => {
        if (!prev || !prev.asset) return prev;
        return {
          ...prev,
          asset: {
            ...prev.asset,
            payload: {
              ...prev.asset.payload,
              audioUrl: res.audioUrl,
              turns: res.turns,
              audioEngine: engine,
            },
          },
        };
      });

      if (supported) window.speechSynthesis.cancel();
      setPlaying(false);
      playingRef.current = false;
      props.notify("Studio podcast audio generated successfully!", "success");
    } catch (err) {
      setSynthesisError(errorMessage(err));
    } finally {
      setSynthesizing(false);
    }
  };

  // Save inline ElevenLabs key
  const saveInlineKey = async () => {
    if (!inlineElevenKey.trim()) return;
    setSavingKey(true);
    try {
      await api("/api/settings", {
        method: "PUT",
        json: { elevenLabsApiKey: inlineElevenKey.trim(), podcastAudioEngine: "elevenlabs" },
      });
      setHasElevenKey(true);
      setKeySavedMessage("ElevenLabs key saved to your settings!");
      props.notify("ElevenLabs key saved.", "success");
      const vRes = await api<{ voices: Array<any> }>(`/api/podcast/voices?apiKey=${encodeURIComponent(inlineElevenKey.trim())}`);
      if (vRes?.voices) setElevenVoices(vRes.voices);
    } catch (err) {
      props.notify(errorMessage(err), "error");
    } finally {
      setSavingKey(false);
    }
  };

  // Design voice based on AI Personalization profile
  const designVoiceFromAi = async (role: "host" | "guest") => {
    setDesigningVoice(role);
    const pers = getStoredPersonalization();
    try {
      const res = await api<{ voiceId: string; voiceName: string; message: string }>("/api/podcast/voices", {
        method: "POST",
        json: {
          action: "design-from-personalization",
          personaLabel: PERSONA_DESCRIPTIONS[pers.persona]?.label || "Friendly & Encouraging",
          personaTone: PERSONA_DESCRIPTIONS[pers.persona]?.tone || "Warm and supportive",
          learningStyleDesc: LEARNING_STYLE_DESCRIPTIONS[pers.learningStyle]?.desc || "Visual & Structured explanations",
          learnerName: pers.learnerName,
          customInstructions: pers.customInstructions,
          role,
          apiKey: inlineElevenKey.trim() || undefined,
        },
      });

      if (role === "host") setElevenHostVoice(res.voiceId);
      else setElevenGuestVoice(res.voiceId);

      props.notify(`Personalized ${role === "host" ? "Host" : "Guest"} voice designed: ${res.voiceName}!`, "success");
      const vRes = await api<{ voices: Array<any> }>("/api/podcast/voices");
      if (vRes?.voices) setElevenVoices(vRes.voices);
    } catch (err) {
      props.notify(errorMessage(err), "error");
    } finally {
      setDesigningVoice(null);
    }
  };

  // Handle reference audio file upload (.wav/.mp3)
  const handleReferenceAudioFile = (role: "host" | "guest", e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64 = evt.target?.result as string;
      if (role === "host") {
        setHostRefAudio(base64);
        setHostRefName(file.name);
      } else {
        setGuestRefAudio(base64);
        setGuestRefName(file.name);
      }
      props.notify(`Reference voice sample loaded for ${role === "host" ? "Speaker 1" : "Speaker 2"}!`, "info");
    };
    reader.readAsDataURL(file);
  };

  const progress = script ? Math.round(((turn + (playing ? 0.5 : 0)) / script.turns.length) * 100) : 0;
  const estMinutes = script ? Math.max(1, Math.round(script.turns.reduce((n, t) => n + t.text.split(/\s+/).length, 0) / 150)) : 0;

  return (
    <StudyShell props={props} icon={<Headphones size={25} />} eyebrow="Audio overview" title="Turn your notes into a conversation" copy="A host and an expert guest discuss the selected chapter or the whole subject." ariaId="podcast-title">
      {/* Audio Engine Selection Bar */}
      <div className="audio-engine-bar" role="radiogroup" aria-label="Podcast speech audio engine">
        <span className="engine-label"><Volume2 size={15} /> Audio engine:</span>
        <button
          type="button"
          className={`engine-pill ${engine === "speechSynthesis" ? "active" : ""}`}
          onClick={() => setEngine("speechSynthesis")}
        >
          OS System voices
        </button>
        <button
          type="button"
          className={`engine-pill ${engine === "elevenlabs" ? "active" : ""}`}
          onClick={() => setEngine("elevenlabs")}
        >
          ElevenLabs AI studio
        </button>
        <button
          type="button"
          className={`engine-pill ${engine === "kokoclone" ? "active" : ""}`}
          onClick={() => setEngine("kokoclone")}
        >
          KokoClone (Local Cloner)
        </button>
      </div>

      <div className="generator-controls">
        <div className="length-control" role="radiogroup" aria-label="Podcast length">
          {(["short", "medium", "long"] as const).map((option, index) => (
            <button id={`length-${option}`} type="button" role="radio" aria-checked={length === option} className={length === option ? "active" : ""} onClick={() => setLength(option)} onKeyDown={(event) => onLengthKey(event, index)} key={option}>{option[0].toUpperCase() + option.slice(1)}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="primary-button" onClick={() => (aiReady ? generate({ length }) : onConfigureAi())} disabled={generating || !scope}>
            {script ? <RefreshCw size={17} aria-hidden="true" /> : <WandSparkles size={17} aria-hidden="true" />}{script ? "Regenerate Script" : "Generate podcast"}
          </button>

          {script && engine !== "speechSynthesis" && (
            <button
              type="button"
              className="secondary-button"
              onClick={isGeneratingContinuously ? stopGeneratingContinuously : generateStudioAudio}
              disabled={(synthesizing && !isGeneratingContinuously) || (engine === "elevenlabs" && !hasElevenKey && !inlineElevenKey.trim())}
              style={isGeneratingContinuously ? { borderColor: "var(--red, #f38ba8)", color: "var(--red, #f38ba8)" } : undefined}
            >
              {isGeneratingContinuously ? (
                <>
                  <Square size={16} /> Stop Stream ({generatingTurnIndex !== null ? `Turn ${generatingTurnIndex + 1}/${script.turns.length}` : "Stopping…"})
                </>
              ) : synthesizing ? (
                <Spinner label="Synthesizing dialogue…" />
              ) : (
                <>
                  <Sparkles size={16} />
                  {completedTurnsCount > 0 && completedTurnsCount < script.turns.length
                    ? `Continue Stream (${completedTurnsCount}/${script.turns.length} ready)`
                    : completedTurnsCount === script.turns.length
                    ? "Re-generate Studio Audio"
                    : `Generate Audio (${engine === "elevenlabs" ? "ElevenLabs" : "Continuous KokoClone"})`}
                </>
              )}
            </button>
          )}

          {script?.audioUrl && (
            <a
              href={`${script.audioUrl}&download=1`}
              download={`${script.title.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "podcast"}.mp3`}
              className="secondary-button compact"
              title="Download generated MP3 podcast"
            >
              <Download size={15} /> Download MP3
            </a>
          )}
        </div>
      </div>

      <GenerationNotice asset={data?.asset ?? null} generating={generating} providerName={providerName} label="the podcast script" />
      <AiErrorAlert error={error} onRetry={retry} onConfigure={onConfigureAi} />
      {synthesisError && <InlineAlert tone="error">{synthesisError}</InlineAlert>}

      {/* Inline ElevenLabs API Key Prompt */}
      {engine === "elevenlabs" && !hasElevenKey && (
        <div className="elevenlabs-prompt-card">
          <div className="elevenlabs-prompt-head">
            <span><Cloud size={18} /></span>
            <div>
              <strong>Connect ElevenLabs for Studio Voice Synthesis</strong>
              <p>Enter your ElevenLabs API key once to generate realistic podcasts, design custom voices from your AI profile, or clone voices from audio.</p>
            </div>
          </div>
          <div className="elevenlabs-prompt-input">
            <input
              type={showInlineElevenKey ? "text" : "password"}
              value={inlineElevenKey}
              onChange={(e) => setInlineElevenKey(e.target.value)}
              placeholder="xi-api-key or paste key here"
              autoComplete="off"
            />
            <button type="button" className="icon-button" onClick={() => setShowInlineElevenKey((s) => !s)} aria-label={showInlineElevenKey ? "Hide key" : "Show key"}>
              {showInlineElevenKey ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
            <button type="button" className="primary-button compact" onClick={saveInlineKey} disabled={savingKey || !inlineElevenKey.trim()}>
              {savingKey ? "Saving…" : "Save key"}
            </button>
          </div>
          {keySavedMessage && <p className="success-note" style={{ margin: "4px 0 0", color: "var(--green)", fontSize: 12 }}>{keySavedMessage}</p>}
        </div>
      )}

      {loading ? <p className="gen-status"><Spinner label="Loading saved podcast…" /></p> : !script ? (
        <section className="podcast-empty" aria-label="No podcast yet">
          <span className="podcast-art" role="img" aria-label="Decorative audio waveform"><i /><i /><i /><i /><i /><i /><i /></span>
          <h2>No podcast for this scope yet</h2>
          <p>Choose a length and generate. The script is written only from the notes in the selected scope and saved locally so it reloads instantly next time.</p>
        </section>
      ) : (
        <section className="podcast-layout" aria-label="Podcast player and transcript">
          <div className="podcast-player" tabIndex={0} onKeyDown={onPlayerKey} aria-label="Podcast player. Space plays or pauses, arrow keys change turn.">
            {/* Real Audio Player Element */}
            <audio
              ref={audioRef}
              src={script.turns[turn]?.audioUrl || script.audioUrl || undefined}
              preload="metadata"
              onPlay={() => {
                setPlaying(true);
                playingRef.current = true;
              }}
              onPause={() => {
                setPlaying(false);
                playingRef.current = false;
              }}
              onLoadedMetadata={(e) => {
                if (e.currentTarget.duration && !isNaN(e.currentTarget.duration)) {
                  setRealAudioDuration(e.currentTarget.duration);
                }
              }}
              onTimeUpdate={() => {
                if (!audioRef.current || !script) return;
                const turnBase = turnStarts[turn] ?? 0;
                setCurrentTime(turnBase + (audioRef.current.currentTime || 0));
              }}
              onEnded={() => {
                if (!script) return;
                const next = turn + 1;
                if (next < script.turns.length) {
                  if (script.turns[next]?.audioUrl) {
                    playTurnAudio(next);
                  } else if (isGeneratingContinuouslyRef.current) {
                    setWaitingForTurn(next);
                  } else {
                    setPlaying(false);
                    playingRef.current = false;
                  }
                } else {
                  setPlaying(false);
                  playingRef.current = false;
                  setTurn(0);
                  setCurrentTime(0);
                }
              }}
              style={{ display: "none" }}
              aria-hidden="true"
            />
            <div className="player-cover" role="img" aria-label="Abstract purple audio cover art">
              <span>N</span>
              <div className="cover-wave"><i /><i /><i /><i /><i /></div>
              {script.audioUrl && (
                <span className="studio-audio-badge" title="High fidelity audio generated with neural voices">
                  <Sparkles size={12} /> Studio Audio
                </span>
              )}
            </div>
            <div className="player-copy">
              <span className="eyebrow">
                Audio overview · {String(data?.asset?.options.length ?? length)} · ≈{estMinutes} min {script.audioEngine ? `· ${script.audioEngine}` : ""}
              </span>
              <h2>{script.title}</h2>
              <p>{script.summary || props.scopeTitle}</p>
            </div>
            <div className="waveform" role="progressbar" aria-label="Playback progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
              {Array.from({ length: 40 }, (_, index) => <i className={(index / 40) * 100 <= progress ? "played" : ""} style={{ height: `${12 + ((index * 13) % 30)}px` }} key={index} />)}
            </div>
            <div className="audio-timeline-wrap">
              <div className="audio-timeline-header">
                <span className="timeline-time">{formatClock(currentTime)}</span>
                <span className="timeline-time">{formatClock(totalDuration)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={Math.max(1, totalDuration)}
                step={0.5}
                value={Math.min(totalDuration, currentTime)}
                onChange={handleSeek}
                onInput={handleSeek}
                className="audio-timeline-slider"
                aria-label="Audio timeline progress"
              />
            </div>
            <div className="player-controls">
              <button type="button" className="icon-button" onClick={() => jump(turn - 1)} aria-label="Previous turn" disabled={turn === 0}><SkipBack size={18} aria-hidden="true" /></button>
              <button type="button" className="play-button" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>{playing ? <Pause size={20} aria-hidden="true" /> : <Play size={20} aria-hidden="true" />}</button>
              <button type="button" className="icon-button" onClick={() => jump(turn + 1)} aria-label="Next turn" disabled={turn >= script.turns.length - 1}><SkipForward size={18} aria-hidden="true" /></button>
              <span aria-live="polite">Turn {turn + 1} / {script.turns.length}</span>
              <div className="speed-buttons" role="group" aria-label="Playback speed">
                {[0.85, 1, 1.15].map((selectedRate) => (
                  <button
                    key={selectedRate}
                    type="button"
                    className={`speed-btn ${rate === selectedRate ? "active" : ""}`}
                    onClick={() => handleRateChange(selectedRate)}
                    aria-pressed={rate === selectedRate}
                    aria-label={`Playback speed ${selectedRate}x`}
                  >
                    {selectedRate}x
                  </button>
                ))}
              </div>
            </div>

            {/* Voice and Voice Cloning Controls */}
            <div className="voice-controls">
              {engine === "speechSynthesis" && (
                <>
                  <label>
                    <span>Speaker 1 (Host) OS voice</span>
                    <select
                      value={hostVoice}
                      onChange={(event) => {
                        setHostVoice(event.target.value);
                        if (playingRef.current && script.turns[turn]?.speaker === "host" && !script.audioUrl) {
                          speak(turn);
                        }
                      }}
                      aria-label="Speaker 1 Host voice"
                    >
                      {voices.length > 0 ? (
                        voices.map((voice) => (
                          <option value={voice.name} key={voice.name}>
                            {voice.name} ({voice.lang})
                          </option>
                        ))
                      ) : (
                        <option value="">System Default Voice (Host)</option>
                      )}
                    </select>
                  </label>
                  <label>
                    <span>Speaker 2 (Guest) OS voice</span>
                    <select
                      value={guestVoice}
                      onChange={(event) => {
                        setGuestVoice(event.target.value);
                        if (playingRef.current && script.turns[turn]?.speaker === "guest" && !script.audioUrl) {
                          speak(turn);
                        }
                      }}
                      aria-label="Speaker 2 Guest voice"
                    >
                      {voices.length > 0 ? (
                        voices.map((voice) => (
                          <option value={voice.name} key={voice.name}>
                            {voice.name} ({voice.lang})
                          </option>
                        ))
                      ) : (
                        <option value="">System Default Voice (Guest)</option>
                      )}
                    </select>
                  </label>
                </>
              )}

              {engine === "elevenlabs" && (
                <>
                  <div className="voice-field-block">
                    <label>
                      <span>Speaker 1 (Host) ElevenLabs voice</span>
                      <select
                        value={elevenHostVoice}
                        onChange={(e) => setElevenHostVoice(e.target.value)}
                        aria-label="Speaker 1 Host ElevenLabs voice"
                      >
                        {elevenVoices.map((v) => (
                          <option value={v.id} key={v.id}>
                            {v.name} {v.description ? `— ${v.description}` : `(${v.category || "custom"})`}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="voice-actions-row">
                      <button
                        type="button"
                        className="text-action-button"
                        onClick={() => void designVoiceFromAi("host")}
                        disabled={Boolean(designingVoice) || (!hasElevenKey && !inlineElevenKey.trim())}
                        title="Crafts a personalized host voice matching your active AI profile"
                      >
                        <Wand2 size={12} /> {designingVoice === "host" ? "Designing…" : "Design from AI Profile"}
                      </button>
                      <label className="text-action-button upload-label" title="Upload reference audio (.wav or .mp3) to clone this voice">
                        <Upload size={12} /> {hostRefName ? `Sample: ${hostRefName.slice(0, 12)}…` : "Clone with audio"}
                        <input
                          type="file"
                          accept="audio/wav,audio/mp3,audio/mpeg"
                          style={{ display: "none" }}
                          onChange={(e) => handleReferenceAudioFile("host", e)}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="voice-field-block">
                    <label>
                      <span>Speaker 2 (Guest) ElevenLabs voice</span>
                      <select
                        value={elevenGuestVoice}
                        onChange={(e) => setElevenGuestVoice(e.target.value)}
                        aria-label="Speaker 2 Guest ElevenLabs voice"
                      >
                        {elevenVoices.map((v) => (
                          <option value={v.id} key={v.id}>
                            {v.name} {v.description ? `— ${v.description}` : `(${v.category || "custom"})`}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="voice-actions-row">
                      <button
                        type="button"
                        className="text-action-button"
                        onClick={() => void designVoiceFromAi("guest")}
                        disabled={Boolean(designingVoice) || (!hasElevenKey && !inlineElevenKey.trim())}
                        title="Crafts a personalized guest voice matching your active AI profile"
                      >
                        <Wand2 size={12} /> {designingVoice === "guest" ? "Designing…" : "Design from AI Profile"}
                      </button>
                      <label className="text-action-button upload-label" title="Upload reference audio (.wav or .mp3) to clone this voice">
                        <Upload size={12} /> {guestRefName ? `Sample: ${guestRefName.slice(0, 12)}…` : "Clone with audio"}
                        <input
                          type="file"
                          accept="audio/wav,audio/mp3,audio/mpeg"
                          style={{ display: "none" }}
                          onChange={(e) => handleReferenceAudioFile("guest", e)}
                        />
                      </label>
                    </div>
                  </div>
                </>
              )}

              {engine === "kokoclone" && (
                <div className="kokoclone-panel" style={{ gridColumn: "1 / -1" }}>
                  <div className="kokoclone-status-bar">
                    <span className="koko-status-pill">
                      <Radio size={12} /> KokoClone {kokoOnline ? "Online" : "Endpoint"} ({kokoEndpoint})
                    </span>
                    <small>Zero-shot continuous voice cloning from reference audio</small>
                  </div>

                  <div className="kokoclone-uploads-row">
                    <div className="ref-audio-box">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>Speaker 1 Reference Audio:</span>
                        {Boolean(hostRefName) && (
                          <button
                            type="button"
                            className="text-action-button"
                            onClick={() => {
                              setHostRefAudio(null);
                              setHostRefName("");
                            }}
                            title="Reset to default voice sample"
                            style={{ fontSize: 11, padding: "2px 4px" }}
                          >
                            Reset default
                          </button>
                        )}
                      </div>
                      <label className="upload-pill-wrap">
                        <Upload size={14} />
                        <span>{hostRefName ? hostRefName : "sera.mp3 (Default sample)"}</span>
                        <input
                          type="file"
                          accept="audio/wav,audio/mp3,audio/mpeg"
                          onChange={(e) => handleReferenceAudioFile("host", e)}
                        />
                      </label>
                    </div>

                    <div className="ref-audio-box">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>Speaker 2 Reference Audio:</span>
                        {Boolean(guestRefName) && (
                          <button
                            type="button"
                            className="text-action-button"
                            onClick={() => {
                              setGuestRefAudio(null);
                              setGuestRefName("");
                            }}
                            title="Reset to default voice sample"
                            style={{ fontSize: 11, padding: "2px 4px" }}
                          >
                            Reset default
                          </button>
                        )}
                      </div>
                      <label className="upload-pill-wrap">
                        <Upload size={14} />
                        <span>{guestRefName ? guestRefName : "Yumeko.mp3 (Default sample)"}</span>
                        <input
                          type="file"
                          accept="audio/wav,audio/mp3,audio/mpeg"
                          onChange={(e) => handleReferenceAudioFile("guest", e)}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Live Continuous Generation Stream Bar */}
                  {script?.turns?.length && (
                    <div className="kokoclone-continuous-bar">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                        <span className="kokoclone-sections-title">
                          <Sparkles size={13} /> Continuous Stream ({completedTurnsCount}/{script.turns.length} turns ready)
                        </span>
                        {isGeneratingContinuously ? (
                          <button
                            type="button"
                            className="secondary-button compact"
                            onClick={stopGeneratingContinuously}
                            style={{ color: "var(--red, #f38ba8)", borderColor: "var(--red, #f38ba8)" }}
                          >
                            <Square size={12} /> Stop Stream
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="primary-button compact"
                            onClick={startContinuousGeneration}
                            disabled={synthesizing}
                          >
                            <Play size={12} /> {completedTurnsCount === 0 ? "Start Continuous Stream" : "Continue Stream"}
                          </button>
                        )}
                      </div>

                      <div className="continuous-track">
                        {script.turns.map((t, idx) => {
                          const isGen = Boolean(t.audioUrl);
                          const isCurrent = generatingTurnIndex === idx;
                          const isSpeaking = playing && turn === idx;
                          return (
                            <div
                              key={idx}
                              className={`turn-chip ${isGen ? "turn-chip--ready" : ""} ${isCurrent ? "turn-chip--generating" : ""} ${isSpeaking ? "turn-chip--speaking" : ""}`}
                              title={`Turn ${idx + 1} (${t.speaker}): ${isCurrent ? "Synthesizing now..." : isGen ? "Cloned audio ready (click to play)" : "Waiting (click to generate)"}`}
                              onClick={() => (isGen ? playTurnAudio(idx) : void generateSingleTurn(idx))}
                            >
                              <span className="chip-speaker">{t.speaker === "host" ? "H" : "G"}{idx + 1}</span>
                              {isCurrent ? (
                                <Spinner label="" />
                              ) : isGen ? (
                                <Check size={10} />
                              ) : (
                                <Circle size={7} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="transcript-card">
            <div className="transcript-head"><div><p className="eyebrow">Follow along</p><h2>Transcript</h2></div><span>{script.turns.length} turns</span></div>
            <div className="transcript-stream">
              {script.turns.map((item, index) => {
                const active = index === turn;
                const words = item.text.split(/\s+/);
                return (
                  <button
                    type="button"
                    onClick={() => {
                      if (item.audioUrl) {
                        playTurnAudio(index);
                      } else {
                        setTurn(index);
                        setWordIndex(-1);
                        speak(index);
                      }
                    }}
                    className={`transcript-turn ${active ? "active" : ""}`}
                    aria-current={active ? "true" : undefined}
                    key={`${index}-${item.speaker}`}
                  >
                    <span className={`speaker-avatar speaker-avatar--${item.speaker === "host" ? "H" : "G"}`} aria-label={item.speaker === "host" ? "Host" : "Guest"}>{item.speaker === "host" ? "H" : "G"}</span>
                    <span>
                      <strong>{item.speaker === "host" ? "Host" : "Guest"}</strong>
                      <span>{active && playing ? words.map((word, wi) => <span key={wi} className={wi === wordIndex ? "word-active" : wi < wordIndex ? "word-done" : ""}>{word} </span>) : item.text}</span>
                    </span>
                    {generatingTurnIndex === index && (
                      <span className="turn-generating-badge">
                        <Spinner label="Synthesizing…" />
                      </span>
                    )}
                    {item.audioUrl && generatingTurnIndex !== index && (
                      <span className="turn-audio-badge" title="Cloned audio ready">
                        <Check size={10} /> Cloned
                      </span>
                    )}
                    {active && playing && <span className="speaking-bars" aria-label="Currently speaking"><i /><i /><i /></span>}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}
      <p className="risk-note">Scripts are generated from your notes and may simplify or misstate details. Voices are your operating system's text-to-speech voices; no cloud audio service is used.</p>
    </StudyShell>
  );
}

/* --------------------------------- Flashcards -------------------------------- */

export function FlashcardsView(props: StudyProps) {
  const { scope, aiReady, providerName, onConfigureAi, notify } = props;
  const { data, setData, loading, generating, error, generate, retry } = useAsset<FlashcardDeck>("flashcards", scope);
  const [count, setCount] = useState(12);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const cards = useMemo(() => data?.asset?.payload.cards ?? [], [data?.asset?.payload.cards]);
  const progress = useMemo(() => data?.progress ?? [], [data?.progress]);

  const metrics = useMemo(() => ({
    new: progress.filter((p) => p.status === "new").length,
    learning: progress.filter((p) => p.status === "learning").length,
    mastered: progress.filter((p) => p.status === "mastered").length,
  }), [progress]);

  const numericScore = metrics.mastered * 2 + metrics.learning * 1;
  const maxScore = cards.length * 2;
  const scorePercentage = maxScore > 0 ? Math.round((numericScore / maxScore) * 100) : 0;
  const due = progress.filter((p) => p.status !== "new" && p.dueAt && new Date(p.dueAt).getTime() <= Date.now()).length;

  useEffect(() => {
    setIndex(0);
    setRevealed(false);
  }, [data?.asset?.id]);

  useEffect(() => {
    if (!scope || !cards.length || !progress.length) return;
    saveFlashcardSessionScore(scope, {
      score: numericScore,
      maxScore,
      mastered: metrics.mastered,
      learning: metrics.learning,
      newCount: metrics.new,
      total: cards.length,
      percentage: scorePercentage,
    });
  }, [scope, cards.length, progress, numericScore, maxScore, metrics, scorePercentage]);

  const move = (delta: number) => {
    if (!cards.length) return;
    setIndex((current) => Math.max(0, current + delta));
    setRevealed(false);
  };

  const rate = async (rating: "again" | "good" | "easy") => {
    if (!data?.asset) return;
    try {
      const result = await api<{ progress: CardProgress[] }>("/api/generate", { method: "PATCH", json: { assetId: data.asset.id, cardIndex: index, rating } });
      setData({ ...data, progress: result.progress });
      if (scope) {
        const updatedMastered = result.progress.filter((p) => p.status === "mastered").length;
        const updatedLearning = result.progress.filter((p) => p.status === "learning").length;
        const updatedNew = result.progress.filter((p) => p.status === "new").length;
        const updatedScore = updatedMastered * 2 + updatedLearning * 1;
        const updatedMax = cards.length * 2;
        saveFlashcardSessionScore(scope, {
          score: updatedScore,
          maxScore: updatedMax,
          mastered: updatedMastered,
          learning: updatedLearning,
          newCount: updatedNew,
          total: cards.length,
          percentage: updatedMax > 0 ? Math.round((updatedScore / updatedMax) * 100) : 0,
        });
      }
      move(1);
    } catch (err) {
      notify(errorMessage(err), "error");
    }
  };

  const handleCardDoubleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    void rate("again");
  };

  const onCardKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowRight") move(1);
    if (event.key === "ArrowLeft") move(-1);
    if (revealed && ["1", "2", "3"].includes(event.key)) void rate(event.key === "1" ? "again" : event.key === "2" ? "good" : "easy");
  };

  const regenerate = () => {
    if (!aiReady) return onConfigureAi();
    void generate({ count });
  };

  const isEndScreen = cards.length > 0 && index >= cards.length;
  const card = cards[index];
  const state = progress.find((p) => p.cardIndex === index);

  return (
    <StudyShell props={props} icon={<SquareStack size={25} />} eyebrow="Spaced repetition" title="Make knowledge stick" copy="Cards are synthesized from the notes in the selected scope and scheduled with a spaced-repetition interval." ariaId="flashcards-title">
      <div className="generator-controls">
        <div className="count-control-group">
          <span className="count-label">Cards</span>
          <div className="preset-buttons" role="radiogroup" aria-label="Deck size presets">
            {[8, 12, 20].map((preset) => (
              <button
                key={preset}
                type="button"
                className={`preset-btn ${count === preset ? "active" : ""}`}
                onClick={() => setCount(preset)}
              >
                {preset}
              </button>
            ))}
          </div>
          <label className="custom-count-input-wrap">
            <span>Custom</span>
            <input
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={(event) => {
                const val = parseInt(event.target.value, 10);
                if (!isNaN(val)) setCount(Math.max(1, Math.min(100, val)));
              }}
              className="custom-count-input"
              placeholder="1-100"
            />
          </label>
        </div>
        <button type="button" className="primary-button" onClick={regenerate} disabled={generating || !scope}>
          {cards.length ? <RefreshCw size={17} aria-hidden="true" /> : <WandSparkles size={17} aria-hidden="true" />}{cards.length ? "Regenerate deck" : "Generate flashcards"}
        </button>
      </div>
      <GenerationNotice asset={data?.asset ?? null} generating={generating} providerName={providerName} label="flashcards" />
      <AiErrorAlert error={error} onRetry={retry} onConfigure={onConfigureAi} />

      {loading ? <p className="gen-status"><Spinner label="Loading saved deck…" /></p> : !cards.length ? (
        <section className="flashcard-empty">
          <div className="stack-art" role="img" aria-label="Stack of three study cards"><i /><i /><i><Sparkles size={22} /></i></div>
          <h2>No deck for this scope yet</h2>
          <p>Generate a deck to start reviewing. Decks and your review history are stored locally per chapter and per subject.</p>
        </section>
      ) : isEndScreen ? (
        <section className="flashcard-workspace">
          <div className="flashcard-toolbar">
            <div className="metrics-bar" aria-label="Deck progress">
              <StatusPill label="Total Score" value={`${numericScore}/${maxScore} pts (${scorePercentage}%)`} color="green" />
              <StatusPill label="New" value={metrics.new} color="blue" />
              <StatusPill label="Learning" value={`${metrics.learning} (1 pt)`} color="amber" />
              <StatusPill label="Mastered" value={`${metrics.mastered} (2 pts)`} color="green" />
            </div>
          </div>
          <div className="end-screen-card">
            <span className="end-screen-icon" aria-hidden="true"><Trophy size={36} /></span>
            <h2>Session Complete!</h2>
            <p className="end-screen-subtitle">You have completed reviewing all {cards.length} cards in this deck.</p>
            <div className="end-screen-stats">
              <div className="end-stat-box">
                <span className="stat-label">Session Score</span>
                <strong className="stat-value">{numericScore} <small>/ {maxScore} pts</small></strong>
              </div>
              <div className="end-stat-box">
                <span className="stat-label">Accuracy</span>
                <strong className="stat-value">{scorePercentage}%</strong>
              </div>
            </div>
            <div className="end-screen-breakdown">
              <span className="breakdown-pill breakdown-pill--mastered"><strong>{metrics.mastered}</strong> Mastered (2 pts)</span>
              <span className="breakdown-pill breakdown-pill--learning"><strong>{metrics.learning}</strong> Learning (1 pt)</span>
              <span className="breakdown-pill breakdown-pill--new"><strong>{metrics.new}</strong> New (0 pts)</span>
            </div>
            <div className="end-screen-actions">
              <button type="button" className="primary-button" onClick={() => { setIndex(0); setRevealed(false); }}>
                <RotateCcw size={16} aria-hidden="true" /> Click to Try Again
              </button>
              <button type="button" className="secondary-button" onClick={regenerate} disabled={generating || !scope}>
                <RefreshCw size={16} aria-hidden="true" /> Regenerate Deck
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="flashcard-workspace">
          <div className="flashcard-toolbar">
            <div className="metrics-bar" aria-label="Deck progress">
              <StatusPill label="Score" value={`${numericScore}/${maxScore} pts (${scorePercentage}%)`} color="green" />
              <StatusPill label="New" value={metrics.new} color="blue" />
              <StatusPill label="Learning" value={metrics.learning} color="amber" />
              <StatusPill label="Mastered" value={metrics.mastered} color="green" />
              {due > 0 && <span className="status-pill"><strong>{due}</strong> due for review</span>}
            </div>
          </div>
          <div className="card-counter" aria-live="polite"><span>Card {index + 1} of {cards.length} · {card.topic}{state?.status ? ` · ${state.status}` : ""}</span><div><i style={{ width: `${((index + 1) / cards.length) * 100}%` }} /></div></div>
          <div className="flashcard-stage" onDoubleClick={handleCardDoubleClick} title="Double-click to default rating to Try again">
            <button type="button" className={`study-card ${revealed ? "revealed" : ""}`} onClick={() => setRevealed((value) => !value)} onDoubleClick={handleCardDoubleClick} onKeyDown={onCardKey} aria-pressed={revealed} aria-label={`${revealed ? "Answer" : "Question"}: ${revealed ? card.answer : card.question}. Press Space or Enter to flip, double-click to mark Try again, arrow keys to change card, 1 2 3 to grade.`}>
              <span className="card-face card-front"><small>Question</small><strong>{renderInline(card.question)}</strong><span><Circle size={13} aria-hidden="true" /> Click or press Space to reveal the answer · Double-click to mark Try again</span></span>
              <span className="card-face card-back"><small>Answer</small><strong>{renderInline(card.answer)}</strong><span><CheckCircle2 size={14} aria-hidden="true" /> Grade your recall below · Double-click to mark Try again</span></span>
            </button>
          </div>
          <div className="deck-navigation">
            <button type="button" className="icon-button" onClick={() => move(-1)} aria-label="Previous card" disabled={index === 0}><ChevronLeft size={21} aria-hidden="true" /></button>
            {revealed ? (
              <div className="recall-buttons" role="group" aria-label="Rate your recall">
                <button type="button" onClick={() => rate("again")}><RotateCcw size={15} aria-hidden="true" />Again <kbd>1</kbd></button>
                <button type="button" onClick={() => rate("good")}><Gauge size={15} aria-hidden="true" />Good <kbd>2</kbd></button>
                <button type="button" onClick={() => rate("easy")}><Check size={15} aria-hidden="true" />Easy <kbd>3</kbd></button>
              </div>
            ) : <span className="reveal-hint">Reveal the answer to grade this card (or double-click to try again)</span>}
            <button type="button" className="icon-button" onClick={() => move(1)} aria-label="Next card"><ChevronRight size={21} aria-hidden="true" /></button>
          </div>
        </section>
      )}
    </StudyShell>
  );
}

/* ----------------------------------- Quizzes --------------------------------- */

export function QuizzesView(props: StudyProps) {
  const { scope, aiReady, providerName, onConfigureAi, notify } = props;
  const { data, setData, loading, generating, error, generate, retry } = useAsset<QuizPayload>("quiz", scope);
  const [setupOpen, setSetupOpen] = useState(false);
  const [difficulty, setDifficulty] = useState("Intermediate");
  const [count, setCount] = useState(10);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [isScrolledPastHeader, setIsScrolledPastHeader] = useState(false);
  const headerSentinelRef = useRef<HTMLDivElement>(null);
  const questions = useMemo(() => data?.asset?.payload.questions ?? [], [data?.asset?.payload.questions]);
  const attempts: QuizAttempt[] = useMemo(() => data?.attempts ?? [], [data?.attempts]);

  useEffect(() => {
    const el = headerSentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsScrolledPastHeader(!entry.isIntersecting);
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [questions.length]);

  useEffect(() => {
    setAnswers({});
    setSubmitted(false);
  }, [data?.asset?.id]);

  useEffect(() => {
    if (!scope || !attempts.length) return;
    const best = attempts.reduce((max, a) => (a.score > max.score ? a : max), attempts[0]);
    if (best) {
      saveQuizAttemptScore(scope, {
        score: best.score,
        total: best.total,
        percentage: best.total > 0 ? Math.round((best.score / best.total) * 100) : 0,
      });
    }
  }, [scope, attempts]);

  const score = questions.reduce((total, q, i) => total + (answers[i] === q.correctIndex ? 1 : 0), 0);
  const answered = Object.keys(answers).length;
  const topics = useMemo(() => {
    const map = new Map<string, { correct: number; total: number; answered: number }>();
    questions.forEach((q, i) => {
      const entry = map.get(q.topic) ?? { correct: 0, total: 0, answered: 0 };
      entry.total += 1;
      if (answers[i] !== undefined) {
        entry.answered += 1;
        if (answers[i] === q.correctIndex) entry.correct += 1;
      }
      map.set(q.topic, entry);
    });
    return Array.from(map.entries()).map(([topic, value]) => ({ topic, ...value, percent: value.answered ? Math.round((value.correct / value.answered) * 100) : 0 }));
  }, [questions, answers]);

  useEffect(() => {
    if (!data?.asset || submitted || !questions.length || answered !== questions.length) return;
    const breakdown = Object.fromEntries(topics.map((t) => [t.topic, { correct: t.correct, total: t.total }]));
    setSubmitted(true);
    if (scope) {
      const pct = Math.round((score / questions.length) * 100);
      saveQuizAttemptScore(scope, {
        score,
        total: questions.length,
        percentage: pct,
      });
    }
    api<{ attempts: QuizAttempt[] }>("/api/generate", { method: "PATCH", json: { assetId: data.asset.id, attempt: { answers, score, total: questions.length, topicBreakdown: breakdown } } })
      .then((result) => setData({ ...data, attempts: result.attempts }))
      .catch((err) => notify(errorMessage(err), "error"));
  }, [answered, questions.length, submitted, data, answers, score, topics, setData, notify, scope]);

  const startGeneration = (event: FormEvent) => {
    event.preventDefault();
    if (!aiReady) return onConfigureAi();
    setSetupOpen(false);
    void generate({ difficulty, count });
  };

  return (
    <StudyShell props={props} icon={<ListChecks size={25} />} eyebrow="Knowledge check" title="Test your understanding" copy="Multiple-choice questions written from the selected notes, with instant explanations and mastery tracked by topic." ariaId="quiz-title">
      <div ref={headerSentinelRef} className="generator-controls">
        <button type="button" className="primary-button" onClick={() => (aiReady ? setSetupOpen(true) : onConfigureAi())} disabled={generating || !scope}>{questions.length ? <RefreshCw size={17} aria-hidden="true" /> : <WandSparkles size={17} aria-hidden="true" />}{questions.length ? "New quiz" : "Generate quiz"}</button>
        {questions.length > 0 && <button type="button" className="secondary-button" onClick={() => { setAnswers({}); setSubmitted(false); }}><RotateCcw size={15} aria-hidden="true" />Retake</button>}
      </div>
      <GenerationNotice asset={data?.asset ?? null} generating={generating} providerName={providerName} label="quiz questions" />
      <AiErrorAlert error={error} onRetry={retry} onConfigure={onConfigureAi} />

      {loading ? <p className="gen-status"><Spinner label="Loading saved quiz…" /></p> : !questions.length ? (
        <section className="quiz-empty">
          <span role="img" aria-label="Checklist with completion marks"><ListChecks size={38} /><Sparkles size={19} /></span>
          <h2>No quiz for this scope yet</h2>
          <p>Pick a difficulty and question count. Quizzes and every attempt are stored locally.</p>
        </section>
      ) : (
        <div className="quiz-layout">
          <section className="question-list" aria-label="Quiz questions">
            <div className="question-list-head"><div><p className="eyebrow">{String(data?.asset?.options.difficulty ?? difficulty)} · {questions.length} questions</p><h2>Questions</h2></div><span className="score-chip" aria-live="polite">{score} / {questions.length} correct</span></div>
            {questions.map((question, qi) => {
              const chosen = answers[qi];
              const isAnswered = chosen !== undefined;
              return (
                <fieldset className="question-card" key={qi}>
                  <legend><span>{qi + 1}</span>{question.question}</legend>
                  <div className="option-grid">
                    {question.options.map((option, oi) => {
                      const selected = chosen === oi;
                      const correct = oi === question.correctIndex;
                      return (
                        <label className={`${selected ? "selected" : ""} ${isAnswered && correct ? "correct" : ""} ${isAnswered && selected && !correct ? "incorrect" : ""}`} key={oi}>
                          <input type="radio" name={`question-${qi}`} checked={selected} disabled={isAnswered} onChange={() => setAnswers((current) => ({ ...current, [qi]: oi }))} />
                          <span className="option-letter" aria-hidden="true">{String.fromCharCode(65 + oi)}</span><span>{option}</span>
                          {isAnswered && correct && <CheckCircle2 size={17} aria-label="Correct answer" />}
                          {isAnswered && selected && !correct && <XCircle size={17} aria-label="Your incorrect selection" />}
                        </label>
                      );
                    })}
                  </div>
                  {isAnswered && question.explanation && <p className="explanation" role="status"><strong>{chosen === question.correctIndex ? "Correct." : "Not quite."}</strong> {question.explanation}</p>}
                </fieldset>
              );
            })}
          </section>
          <aside className="mastery-panel" aria-label="Mastery by topic">
            <div className="score-ring" style={{ "--score": `${questions.length ? (score / questions.length) * 360 : 0}deg` } as React.CSSProperties}><span><strong>{score}</strong><small>of {questions.length}</small></span></div>
            <h2>{answered === questions.length ? "Quiz complete" : `${answered} of ${questions.length} answered`}</h2>
            <p>{answered === 0 ? "Choose an answer to start tracking mastery." : `${Math.round((score / Math.max(1, answered)) * 100)}% correct so far.`}</p>

            {/* Sticky Action Sidebar Widget anchored directly below the score box */}
            <div className={`sticky-quiz-actions ${isScrolledPastHeader ? "visible" : ""}`} aria-hidden={!isScrolledPastHeader}>
              <button type="button" className="primary-button compact full-width" onClick={() => (aiReady ? setSetupOpen(true) : onConfigureAi())} disabled={generating || !scope}>
                <RefreshCw size={14} aria-hidden="true" /> New quiz
              </button>
              {questions.length > 0 && (
                <button type="button" className="secondary-button compact full-width" onClick={() => { setAnswers({}); setSubmitted(false); }}>
                  <RotateCcw size={13} aria-hidden="true" /> Retake
                </button>
              )}
            </div>

            <div className="mastery-topics">
              <h3>Mastery by topic</h3>
              {topics.map((topic) => (
                <div className="topic-row" key={topic.topic}>
                  <div><strong>{topic.topic}</strong><span>{topic.correct}/{topic.total}</span></div>
                  <div role="progressbar" aria-label={`${topic.topic} mastery`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={topic.percent}><i style={{ width: `${topic.answered ? (topic.correct / topic.total) * 100 : 0}%` }} /></div>
                </div>
              ))}
            </div>
            {attempts.length > 0 && (
              <div className="attempt-list">
                <h3>Previous attempts</h3>
                {attempts.slice(0, 5).map((attempt) => <div key={attempt.id}><span>{formatDate(attempt.createdAt)}</span><strong>{attempt.score}/{attempt.total}</strong></div>)}
              </div>
            )}
          </aside>
        </div>
      )}

      <Modal open={setupOpen} onClose={() => setSetupOpen(false)} title="Configure quiz" description={`Questions are generated from “${props.scopeTitle}” with ${providerName}.`}>
        <form className="quiz-config-form" onSubmit={startGeneration}>
          <div className="form-row">
            <label className="field"><span>Difficulty</span><select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label>
            <label className="field"><span>Questions</span><select value={count} onChange={(event) => setCount(Number(event.target.value))}><option value={5}>5</option><option value={10}>10</option><option value={20}>20</option></select></label>
          </div>
          <button type="submit" className="primary-button full-width"><WandSparkles size={17} aria-hidden="true" />Generate quiz</button>
        </form>
      </Modal>
    </StudyShell>
  );
}
