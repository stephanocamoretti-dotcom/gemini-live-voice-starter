import { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleGenAI, Modality, type LiveServerMessage } from '@google/genai';
import { startMicPcmStream, type MicStreamController } from '../audio/pcm-worklet';
import { PcmAudioPlayer } from '../audio/pcm-player';

export type LiveConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
export type LiveModelId = 'gemini-3.8-live' | 'gemini-3.8-live-extended-thinking';

export interface TranscriptTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

interface UseGeminiLiveOptions {
  apiKey: string;
  model?: LiveModelId;
  voiceName?: string;
  systemInstruction?: string;
}

export function useGeminiLive({
  apiKey,
  model = 'gemini-3.8-live',
  voiceName = 'Aoede',
  systemInstruction = 'You are a concise, sharp Silicon Valley AI voice engineer. Keep spoken answers crisp and natural.',
}: UseGeminiLiveOptions) {
  const [state, setState] = useState<LiveConnectionState>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [userLevel, setUserLevel] = useState(0);
  const [aiLevel, setAiLevel] = useState(0);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptTurn[]>([]);

  const sessionRef = useRef<Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null>(null);
  const micRef = useRef<MicStreamController | null>(null);
  const playerRef = useRef<PcmAudioPlayer | null>(null);

  const appendTranscript = useCallback((role: 'user' | 'assistant', text: string) => {
    if (!text.trim()) return;
    setTranscripts((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role,
        text: text.trim(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      },
    ]);
  }, []);

  const disconnect = useCallback(() => {
    micRef.current?.stop();
    micRef.current = null;
    playerRef.current?.dispose();
    playerRef.current = null;
    sessionRef.current?.close();
    sessionRef.current = null;
    setUserLevel(0);
    setAiLevel(0);
    setIsAiThinking(false);
    setState('disconnected');
  }, []);

  const connect = useCallback(async () => {
    if (!apiKey) {
      setError('Missing VITE_GEMINI_API_KEY (or ephemeral token).');
      setState('error');
      return;
    }

    try {
      setError(null);
      setState('connecting');

      const ai = new GoogleGenAI({ apiKey });
      const player = new PcmAudioPlayer();
      playerRef.current = player;

      const session = await ai.live.connect({
        model,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: { parts: [{ text: systemInstruction }] },
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setState('connected');
          },
          onmessage: (message: LiveServerMessage) => {
            const serverContent = message.serverContent;
            if (!serverContent) return;

            // Instant Barge-In: flush queued 24kHz audio when user interrupts
            if (serverContent.interrupted) {
              player.flush();
              setAiLevel(0);
            }

            if (serverContent.inputTranscription?.text) {
              appendTranscript('user', serverContent.inputTranscription.text);
            }

            if (serverContent.outputTranscription?.text) {
              appendTranscript('assistant', serverContent.outputTranscription.text);
            }

            const parts = serverContent.modelTurn?.parts ?? [];
            for (const part of parts) {
              if (part.inlineData?.data && part.inlineData.mimeType?.startsWith('audio/pcm')) {
                const rms = player.enqueueBase64Pcm(part.inlineData.data);
                setAiLevel(rms);
              }
            }

            if (serverContent.turnComplete) {
              setAiLevel(0);
              setIsAiThinking(false);
            }
          },
          onerror: (err: ErrorEvent) => {
            setError(err.message || 'WebSocket connection error');
            setState('error');
          },
          onclose: () => {
            setState('disconnected');
          },
        },
      });

      sessionRef.current = session;

      const mic = await startMicPcmStream((base64Pcm, rms) => {
        setUserLevel(rms);
        session.sendRealtimeInput({
          audio: {
            data: base64Pcm,
            mimeType: 'audio/pcm;rate=16000',
          },
        });
      });

      micRef.current = mic;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start Gemini Live session');
      setState('error');
      disconnect();
    }
  }, [apiKey, model, voiceName, systemInstruction, appendTranscript, disconnect]);

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return {
    state,
    error,
    userLevel,
    aiLevel,
    isAiThinking,
    transcripts,
    connect,
    disconnect,
  };
}
