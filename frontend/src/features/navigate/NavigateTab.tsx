import { useEffect, useRef, useState } from 'react';
import { useProfile } from '../../context/ProfileContext';
import type { Detection } from '../../types';

// M1 OWNER: Track 01 Public Space Navigation
// TODO(M1): replace mockDetections with coco-ssd:
//   npm i @tensorflow/tfjs @tensorflow-models/coco-ssd
//   run detect() on video frame, map bbox width -> near/mid/far, x-center -> 0..1

function mockDetections(t: number): Detection[] {
  // Demo fallback so judges see spatial audio without a model.
  // Cycles a fake person left -> center -> right.
  const x = (Math.sin(t / 1500) + 1) / 2;
  return [{ label: 'person (mock)', x, distance: x < 0.33 || x > 0.66 ? 'mid' : 'near' }];
}

function beep(pan: number, freq: number) {
  const AC = window.AudioContext;
  if (!AC) return;
  const ctx = new AC();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const panner = ctx.createStereoPanner();
  osc.frequency.value = freq;
  panner.pan.value = Math.min(1, Math.max(-1, pan * 2 - 1));
  osc.connect(gain).connect(panner).connect(ctx.destination);
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
  osc.stop(ctx.currentTime + 0.25);
  osc.onended = () => void ctx.close();
}

export default function NavigateTab() {
  const { speak } = useProfile();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string>('idle');

  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: 640, height: 480 },
    });
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }
    setRunning(true);
  };

  const stop = () => {
    const s = videoRef.current?.srcObject as MediaStream | null;
    s?.getTracks().forEach((t) => t.stop());
    setRunning(false);
  };

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const dets = mockDetections(Date.now());
      const d = dets[0];
      const clock = d.x < 0.33 ? '9 o’clock' : d.x > 0.66 ? '3 o’clock' : '12 o’clock';
      setLog(`${d.label}, ${d.distance}, ${clock}`);
      beep(d.x, d.distance === 'near' ? 880 : 440);
      if (d.distance === 'near' && d.x > 0.33 && d.x < 0.66) {
        speak(`Stop. Obstacle ahead.`);
        if (navigator.vibrate) navigator.vibrate(200);
      }
    }, 1200);
    return () => window.clearInterval(id);
  }, [running, speak]);

  return (
    <section aria-label="Public space navigation">
      <h2>01 — Navigate</h2>
      <p>{log}</p>
      <video ref={videoRef} muted playsInline style={{ width: '100%', maxWidth: 480, background: '#000' }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {!running ? (
          <button onClick={start}>Start camera</button>
        ) : (
          <button onClick={stop}>Stop</button>
        )}
        <button onClick={() => speak(log)}>Repeat aloud</button>
      </div>
    </section>
  );
}
