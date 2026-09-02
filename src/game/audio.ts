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
}

export function createSounds(): Sounds {
  let ctx: AudioContext | null = null;
  const audio = (): AudioContext => (ctx ??= new AudioContext());

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
  };
}
