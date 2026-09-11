import { useEffect, useState } from 'react';
import { useProfile } from '../../context/ProfileContext';
import { API_BASE, type StationNode } from '../../types';

// M3 OWNER: Track 03 Inclusive Digital Services + Rust backend
// Backend contract: GET {API_BASE}/api/station -> { nodes: StationNode[] }
// TODO(M3): wire webkitSpeechRecognition for "where is X?" voice commands.

export default function ServicesTab() {
  const { speak } = useProfile();
  const [nodes, setNodes] = useState<StationNode[]>([]);
  const [target, setTarget] = useState('platform-2');
  const [status, setStatus] = useState('not loaded');

  useEffect(() => {
    fetch(`${API_BASE}/api/station`)
      .then((r) => r.json())
      .then((d) => {
        setNodes(d.nodes);
        setStatus(`loaded ${d.nodes.length} stops (live backend)`);
      })
      .catch(() => {
        // Offline fallback mirrors backend/src/main.rs mock
        setNodes([
          { id: 'entrance', label: 'Main entrance', connections: ['elevator'] },
          { id: 'elevator', label: 'Elevator', connections: ['entrance', 'platform-2'] },
          { id: 'platform-2', label: 'Platform 2', connections: ['elevator'] },
        ]);
        setStatus('backend offline — using cached station');
      });
  }, []);

  const route = () => {
    const n = nodes.find((x) => x.id === target);
    const msg = n
      ? `Route to ${n.label}: entrance, then elevator, then ${n.label}. 40 meters.`
      : 'Destination not found.';
    setStatus(msg);
    speak(msg);
  };

  return (
    <section aria-label="Inclusive digital services">
      <h2>03 — Services</h2>
      <p>{status}</p>
      <label>
        Destination:{' '}
        <select value={target} onChange={(e) => setTarget(e.target.value)}>
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.label}
            </option>
          ))}
        </select>
      </label>{' '}
      <button onClick={route}>Guide me</button>
      <ul>
        {nodes.map((n) => (
          <li key={n.id}>
            <button onClick={() => { setTarget(n.id); }} style={{ fontSize: '1.1rem', margin: 4 }}>
              {n.label}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
