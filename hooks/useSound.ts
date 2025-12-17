import { useCallback, useRef } from 'react';

export const useSound = () => {
  const audioContextRef = useRef<AudioContext | null>(null);

  const initAudio = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        // Use standard AudioContext
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          audioContextRef.current = new AudioContextClass();
        }
      }
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume().catch(e => console.error("Audio resume failed", e));
      }
    } catch (e) {
      console.warn("Failed to initialize audio", e);
    }
  }, []);

  const playTone = useCallback((freq: number, type: OscillatorType = 'sine', duration = 0.1) => {
    try {
        if (!audioContextRef.current) initAudio();
        const ctx = audioContextRef.current;
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        
        // Smooth attack and release
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start();
        osc.stop(ctx.currentTime + duration);
    } catch (e) {
        // console.error("Error playing tone", e);
    }
  }, [initAudio]);

  const playClick = useCallback(() => {
    // Subtle UI click sound (800Hz sine wave, very short)
    playTone(800, 'sine', 0.05);
  }, [playTone]);

  const playCountdown = useCallback(() => {
    // High pitched beep
    playTone(880, 'sine', 0.1); 
  }, [playTone]);

  const playShutter = useCallback(() => {
    try {
        if (!audioContextRef.current) initAudio();
        const ctx = audioContextRef.current;
        if (!ctx) return;

        const t = ctx.currentTime;
        
        // 1. White Noise burst (mechanical click)
        const bufferSize = ctx.sampleRate * 0.1; // 100ms
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseGain = ctx.createGain();
        
        noiseGain.gain.setValueAtTime(0.5, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);

        // Lowpass filter for the noise
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, t);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        noise.start();
        
        // 2. Low sine thump (shutter mechanics)
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);
        
        const oscGain = ctx.createGain();
        oscGain.gain.setValueAtTime(0.3, t);
        oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        
        osc.connect(oscGain);
        oscGain.connect(ctx.destination);
        osc.start();
    } catch (e) {
        // console.error("Error playing shutter", e);
    }
  }, [initAudio]);

  const playSuccess = useCallback(() => {
    try {
        if (!audioContextRef.current) initAudio();
        const ctx = audioContextRef.current;
        if (!ctx) return;

        // Play a happy major chord
        const now = ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C Major
        
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'sine';
            osc.frequency.value = freq;
            
            const startTime = now + (i * 0.1);
            const duration = 0.4;

            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.1, startTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start(startTime);
            osc.stop(startTime + duration);
        });
    } catch (e) {
        // console.error("Error playing success", e);
    }
  }, [initAudio]);

  return { initAudio, playCountdown, playShutter, playSuccess, playClick };
};