/**
 * Inline AudioWorklet processor for 16kHz 16-bit Little-Endian Mono PCM capture.
 * Runs off the main UI thread to avoid audio glitches during React renders.
 * Streams ~100ms chunks (1600 samples at 16kHz) as recommended by Gemini Live API docs.
 */

const WORKLET_CODE = `
class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 1600; // 100ms at 16,000 Hz
    this.buffer = new Int16Array(this.bufferSize);
    this.offset = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channel = input[0];
    let sumSquares = 0;

    for (let i = 0; i < channel.length; i++) {
      const sample = Math.max(-1, Math.min(1, channel[i]));
      sumSquares += sample * sample;
      this.buffer[this.offset++] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;

      if (this.offset >= this.bufferSize) {
        const rms = Math.sqrt(sumSquares / channel.length);
        const chunk = this.buffer.slice(0);
        this.port.postMessage({ pcm: chunk.buffer, rms }, [chunk.buffer]);
        this.offset = 0;
      }
    }
    return true;
  }
}

registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
`;

export interface MicStreamController {
  stop: () => void;
}

export async function startMicPcmStream(
  onPcmChunk: (base64Pcm: string, rmsLevel: number) => void
): Promise<MicStreamController> {
  const audioContext = new AudioContext({ sampleRate: 16000 });
  const mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      sampleRate: 16000,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
  const workletUrl = URL.createObjectURL(blob);
  await audioContext.audioWorklet.addModule(workletUrl);
  URL.revokeObjectURL(workletUrl);

  const source = audioContext.createMediaStreamSource(mediaStream);
  const workletNode = new AudioWorkletNode(audioContext, 'pcm-capture-processor');

  workletNode.port.onmessage = (event: MessageEvent<{ pcm: ArrayBuffer; rms: number }>) => {
    const bytes = new Uint8Array(event.data.pcm);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    onPcmChunk(btoa(binary), event.data.rms);
  };

  source.connect(workletNode);
  workletNode.connect(audioContext.destination);

  return {
    stop: () => {
      workletNode.disconnect();
      source.disconnect();
      mediaStream.getTracks().forEach((track) => track.stop());
      void audioContext.close();
    },
  };
}
