/** Stream de permiso/medición por overlay. El SDK gestiona su propio audio. */
export function createVoiceMicLevel() {
  let stream: MediaStream | undefined;
  let context: AudioContext | undefined;
  let source: MediaStreamAudioSourceNode | undefined;
  let analyser: AnalyserNode | undefined;
  let samples: Float32Array<ArrayBuffer> | undefined;
  let pending: Promise<void> | undefined;
  let generation = 0;
  let muted = false;
  const release = () => {
    generation++;
    source?.disconnect();
    analyser?.disconnect();
    stream?.getTracks().forEach((track) => track.stop());
    if (context && context.state !== "closed") void context.close().catch(() => {});
    stream = undefined; context = undefined; source = undefined; analyser = undefined; samples = undefined;
    pending = undefined;
  };
  return {
    release,
    request: () => {
      if (pending) return pending;
      const current = generation;
      pending = navigator.mediaDevices.getUserMedia({ audio: true }).then(async (acquired) => {
        if (current !== generation) { acquired.getTracks().forEach((track) => track.stop()); return; }
        stream = acquired;
        stream.getTracks().forEach((track) => { track.enabled = !muted; });
        try {
          context = new AudioContext();
          analyser = context.createAnalyser();
          analyser.fftSize = 1024;
          source = context.createMediaStreamSource(stream);
          source.connect(analyser); // Nunca conectar el micrófono a destination.
          samples = new Float32Array(analyser.fftSize);
          if (context.state === "suspended") await context.resume();
        } catch { /* Sin WebAudio: respiración, nunca volumen inventado. */ }
      });
      return pending;
    },
    setMuted: (value: boolean) => {
      muted = value;
      stream?.getTracks().forEach((track) => { track.enabled = !value; });
    },
    getVolume: () => {
      if (muted || !analyser || !samples) return 0;
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) sum += sample * sample;
      return Math.min(1, Math.max(0, (Math.sqrt(sum / samples.length) - 0.008) * 5));
    },
  };
}
