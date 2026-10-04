import { useState } from 'react';
import type { Radio } from '../hooks/useRadio';
import Icon from './Icon';

const FREQUENCIES = ['100.5', '99.8', '103.7', '91.7', '95.3', '88.3', '101.4', '89.6', '96.5', '102.7', '89.9'];

function tickerText(radio: Radio, round: number, frequency: string) {
  switch (radio.status) {
    case 'tuning':
      return 'TUNING IN...';
    case 'blocked':
      return 'PRESS PLAY TO START THE RADIO';
    case 'dead':
      return 'NO SIGNAL... PRESS PLAY TO TRY AGAIN';
    default:
      return `YOU ARE NOW LISTENING TO ${frequency} GUESS FM...RELAX, TUNE IN, AND DROP A PIN...ENJOY ROUND ${round + 1}!`;
  }
}

export default function Player({ radio, round }: { radio: Radio; round: number }) {
  // A made-up frequency that changes each round.
  const [offset] = useState(() => Math.floor(Math.random() * FREQUENCIES.length));
  const frequency = FREQUENCIES[(offset + round * 4) % FREQUENCIES.length];
  const text = tickerText(radio, round, frequency);
  const playing = radio.status === 'on' || radio.status === 'tuning';

  return (
    <section className="player panel" aria-label="Radio">
      <div className="lcd" aria-live="polite">
        {/* Keyed on the text so the scroll restarts from the right whenever the message changes. */}
        <p key={text} style={{ animationDuration: `${Math.max(8, text.length * 0.18)}s` }}>
          {text}
        </p>
      </div>
      <div className="player-controls">
        <button className="icon-button" onClick={radio.toggle} aria-label={playing ? 'Pause' : 'Play'}>
          <Icon name={playing ? 'pause' : 'play'} size={35} />
        </button>
        <span className="embossed">GUESS FM</span>
        <button className={radio.muted ? 'icon-button' : 'icon-button dim'} onClick={radio.toggleMute} aria-label={radio.muted ? 'Unmute' : 'Mute'} aria-pressed={radio.muted}>
          <Icon name="volumeOff" size={35} />
        </button>
      </div>
      <label className={radio.muted ? 'volume muted' : 'volume'}>
        <Icon name="volumeDown" />
        <input
          type="range"
          min={0}
          max={100}
          value={radio.volume}
          aria-label="Volume"
          style={{ '--fill': `${radio.volume}%` } as React.CSSProperties}
          onChange={(e) => radio.setVolume(Number(e.target.value))}
        />
        <Icon name="volumeUp" />
      </label>
    </section>
  );
}
