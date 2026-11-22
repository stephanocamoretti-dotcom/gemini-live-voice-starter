import { useState } from 'react';
import { Mic, MicOff, Radio, Sparkles, Volume2 } from 'lucide-react';
import { useGeminiLive, type LiveModelId } from '../live/useGeminiLive';

export function VoiceConsole() {
  const [model, setModel] = useState<LiveModelId>('gemini-3.8-live');
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY ?? '';

  const { state, error, userLevel, aiLevel, transcripts, connect, disconnect } = useGeminiLive({
    apiKey,
    model,
  });

  const isConnected = state === 'connected';
  const orbScale = 1 + Math.min(0.45, Math.max(userLevel, aiLevel) * 2.5);

  return (
    <main
      style={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: 'radial-gradient(circle at 50% 0%, #111c36 0%, #070b14 70%)',
        color: '#f8fafc',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid rgba(148, 163, 184, 0.14)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Radio size={20} color="#38bdf8" />
          <strong style={{ fontSize: 16 }}>Gemini Live Voice Starter</strong>
        </div>

        <select
          value={model}
          disabled={isConnected}
          onChange={(e) => setModel(e.target.value as LiveModelId)}
          style={{
            background: '#0f172a',
            color: '#e2e8f0',
            border: '1px solid rgba(148, 163, 184, 0.25)',
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: 13,
          }}
        >
          <option value="gemini-3.8-live">gemini-3.8-live (Ultra Low-Latency)</option>
          <option value="gemini-3.8-live-extended-thinking">gemini-3.8-live-extended-thinking</option>
        </select>
      </header>

      <section
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          gap: 28,
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            width: 150,
            height: 150,
            borderRadius: '9999px',
            transform: `scale(${orbScale})`,
            transition: 'transform 80ms ease-out',
            background: isConnected
              ? 'radial-gradient(circle, #38bdf8 0%, #6366f1 60%, rgba(99,102,241,0.15) 100%)'
              : 'radial-gradient(circle, #334155 0%, #1e293b 70%)',
            boxShadow: isConnected ? '0 0 60px rgba(56, 189, 248, 0.45)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {aiLevel > 0.01 ? <Volume2 size={44} color="#fff" /> : <Sparkles size={40} color="#e2e8f0" />}
        </div>

        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 14, color: '#94a3b8' }}>
            Status: <strong style={{ color: isConnected ? '#34d399' : '#f8fafc' }}>{state.toUpperCase()}</strong> ·
            16kHz In / 24kHz Out PCM
          </p>
          {error && <p style={{ color: '#f87171', fontSize: 13, marginTop: 8 }}>{error}</p>}
        </div>

        <div
          style={{
            width: '100%',
            maxWidth: 640,
            maxHeight: 240,
            overflowY: 'auto',
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid rgba(148, 163, 184, 0.16)',
            borderRadius: 12,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {transcripts.length === 0 ? (
            <span style={{ color: '#64748b', fontSize: 13 }}>
              Live transcriptions will appear here as you speak...
            </span>
          ) : (
            transcripts.map((turn) => (
              <div key={turn.id} style={{ fontSize: 14, lineHeight: 1.5 }}>
                <strong style={{ color: turn.role === 'user' ? '#38bdf8' : '#34d399' }}>
                  {turn.role === 'user' ? 'You' : 'Gemini'} ({turn.timestamp}):
                </strong>{' '}
                <span>{turn.text}</span>
              </div>
            ))
          )}
        </div>
      </section>

      <footer
        style={{
          padding: 20,
          display: 'flex',
          justifyContent: 'center',
          borderTop: '1px solid rgba(148, 163, 184, 0.14)',
        }}
      >
        <button
          onClick={isConnected ? disconnect : () => void connect()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 28px',
            borderRadius: 9999,
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 15,
            background: isConnected ? '#ef4444' : '#38bdf8',
            color: isConnected ? '#fff' : '#020617',
          }}
        >
          {isConnected ? <MicOff size={18} /> : <Mic size={18} />}
          {isConnected ? 'End Live Session' : 'Start Voice Session'}
        </button>
      </footer>
    </main>
  );
}
