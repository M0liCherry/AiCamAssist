import { useState } from 'react';
import { useProfile } from '../../context/ProfileContext';

// M2 OWNER: Track 02 Adaptive Educational Tech
// TODO(M2): add file upload + tesseract.js OCR, optional LLM summarize.
// Contract: reads profile.cognition to adapt output.

function adapt(text: string, mode: string): string {
  const t = text.trim();
  if (!t) return '';
  if (mode === 'plain') {
    return t.split(/(?<=[.!?])\s+/).slice(0, 3).join(' ');
  }
  if (mode === 'adhd') {
    return t
      .split(/(?<=[.!?])\s+/)
      .slice(0, 5)
      .map((s, i) => `${i + 1}. ${s}`)
      .join('\n');
  }
  return t; // default + dyslexia handled via styling
}

export default function LearnTab() {
  const { profile, setProfile, speak } = useProfile();
  const [input, setInput] = useState(
    'Transit hubs are busy. First, find the elevator. Second, follow tactile paving to platform 2. Third, wait behind the yellow line.'
  );
  const out = adapt(input, profile.cognition);

  return (
    <section aria-label="Adaptive learning">
      <h2>02 — Learn</h2>
      <label>
        Mode:{' '}
        <select
          value={profile.cognition}
          onChange={(e) => setProfile({ cognition: e.target.value as never })}
        >
          <option value="default">Default</option>
          <option value="dyslexia">Dyslexia-friendly</option>
          <option value="adhd">ADHD-chunked</option>
          <option value="plain">Simplified</option>
        </select>
      </label>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={5}
        style={{ width: '100%', marginTop: 8 }}
        aria-label="Learning material input"
      />
      <div
        className={profile.cognition === 'dyslexia' ? 'dyslexia' : ''}
        style={{ whiteSpace: 'pre-wrap', margin: '12px 0', fontSize: '1.2rem' }}
      >
        {out}
      </div>
      <button onClick={() => speak(out)}>Read aloud</button>
    </section>
  );
}
