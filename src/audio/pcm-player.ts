/**
 * Gapless 24kHz 16-bit Little-Endian Mono PCM audio player with instant Barge-In support.
 * Gemini Live API streams native audio output at 24kHz.
 */
export class PcmAudioPlayer {
  private context: AudioContext | null = null;
  private nextStartTime = 0;
  private activeSources: Set<AudioBufferSourceNode> = new Set();

  private ensureContext(): AudioContext {
    if (!this.context || this.context.state === 'closed') {
      this.context = new AudioContext({ sampleRate: 24000 });
      this.nextStartTime = this.context.currentTime;
    }
    if (this.context.state === 'suspended') {
      void this.context.resume();
    }
    return this.context;
  }

  public enqueueBase64Pcm(base64Data: string): number {
    const ctx = this.ensureContext();
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    let sumSquares = 0;

    for (let i = 0; i < int16.length; i++) {
      const normalized = int16[i] / 32768;
      float32[i] = normalized;
      sumSquares += normalized * normalized;
    }

    const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
    audioBuffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const startTime = Math.max(ctx.currentTime + 0.02, this.nextStartTime);
    source.start(startTime);
    this.nextStartTime = startTime + audioBuffer.duration;

    this.activeSources.add(source);
    source.onended = () => {
      this.activeSources.delete(source);
    };

    return Math.sqrt(sumSquares / Math.max(1, float32.length));
  }

  /**
   * Immediately halts all queued and playing AI audio when the user barges in.
   */
  public flush(): void {
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Ignore already-stopped nodes
      }
    }
    this.activeSources.clear();
    if (this.context) {
      this.nextStartTime = this.context.currentTime;
    }
  }

  public dispose(): void {
    this.flush();
    if (this.context && this.context.state !== 'closed') {
      void this.context.close();
    }
    this.context = null;
  }
}
