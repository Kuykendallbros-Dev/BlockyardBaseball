/**
 * A tiny Web Audio sound bank for swing feedback. The AudioContext is created
 * lazily on the first sound so it starts after a user gesture, per browser
 * autoplay rules. Kept out of the scene module so the rendering code stays
 * focused on geometry.
 */

import type { ContactQuality } from './swing.ts';

export interface Sounds {
  /** Bat-on-ball crack; brighter and louder for cleaner contact. */
  crack: (quality: ContactQuality) => void;
  /** Glancing foul tip. */
  foul: () => void;
  /** Air-swinging whiff. */
  whiff: () => void;
  /** Soft catcher's-mitt pop when the batter takes the pitch. */
  mitt: () => void;
  /** Crowd swell after a well-struck ball; bigger for a perfect hit. */
  crowd: (quality: ContactQuality) => void;
}

export function createSounds(): Sounds {
  let ctx: AudioContext | null = null;
  const audio = (): AudioContext => (ctx ??= new AudioContext());

  /** A short burst of filtered white noise with a gain envelope. */
  function noise(
    duration: number,
    peakGain: number,
    filterHz: number,
    attack = 0.05,
  ): void {
    const c = audio();
    const frames = Math.floor(c.sampleRate * duration);
    const buffer = c.createBuffer(1, frames, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

    const src = c.createBufferSource();
    src.buffer = buffer;

    const band = c.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = filterHz;
    band.Q.value = 0.7;

    const amp = c.createGain();
    const now = c.currentTime;
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(peakGain, now + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    src.connect(band).connect(amp).connect(c.destination);
    src.start();
    src.stop(now + duration);
  }

  function tone(
    freq: number,
    duration: number,
    type: OscillatorType,
    gain: number,
    sweepTo?: number,
  ): void {
    const c = audio();
    const osc = c.createOscillator();
    const amp = c.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if (sweepTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(sweepTo, c.currentTime + duration);
    }

    amp.gain.setValueAtTime(gain, c.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);

    osc.connect(amp).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + duration);
  }

  return {
    crack: (quality) => {
      const thump = quality === 'perfect' ? 130 : quality === 'solid' ? 105 : 85;
      tone(thump, 0.09, 'square', 0.3);
      if (quality !== 'weak') {
        tone(quality === 'perfect' ? 520 : 380, 0.11, 'triangle', 0.12);
      }
    },
    foul: () => tone(240, 0.05, 'square', 0.16),
    whiff: () => tone(330, 0.14, 'sawtooth', 0.13, 120),
    mitt: () => tone(90, 0.07, 'sine', 0.14),
    crowd: (quality) => {
      if (quality === 'weak') return;
      const loud = quality === 'perfect';
      noise(loud ? 1.1 : 0.7, loud ? 0.22 : 0.13, loud ? 900 : 700, loud ? 0.25 : 0.15);
    },
  };
}
