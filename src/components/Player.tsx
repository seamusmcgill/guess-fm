import { useLayoutEffect, useRef, useState } from 'react';
import type { Radio } from '../hooks/useRadio';
import Icon from './Icon';

const FREQUENCIES = ['100.5', '99.8', '103.7', '91.7', '95.3', '88.3', '101.4', '89.6', '96.5', '102.7', '89.9'];
const SCROLL_PX_PER_S = 60;

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

type Ticker = { scroll: false } | { scroll: true; from: number; to: number; duration: number; delay: number };

// A message that fits the display sits still; a longer one scrolls right to left, starting with its
// first letter at the left edge so the display is never blank when it changes.
function useTicker(text: string) {
  const track = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const [ticker, setTicker] = useState<Ticker>({ scroll: false });

  useLayoutEffect(() => {
    const measure = () => {
      const width = track.current!.clientWidth;
      const textWidth = label.current!.scrollWidth;
      if (textWidth <= width) return setTicker({ scroll: false });
      const duration = (width + textWidth) / SCROLL_PX_PER_S;
      // At this point in the loop the text's left edge is at the display's left edge.
      setTicker({ scroll: true, from: width, to: -textWidth, duration, delay: -(width / (width + textWidth)) * duration });
    };
    measure();
    document.fonts.ready.then(measure); // the LCD font changes the width once it loads
    const ro = new ResizeObserver(measure);
    ro.observe(track.current!);
    return () => ro.disconnect();
  }, [text]);

  return { track, label, ticker };
}

export default function Player({ radio, round }: { radio: Radio; round: number }) {
  // A made-up frequency that changes each round.
  const [offset] = useState(() => Math.floor(Math.random() * FREQUENCIES.length));
  const frequency = FREQUENCIES[(offset + round * 4) % FREQUENCIES.length];
  const text = tickerText(radio, round, frequency);
  const playing = radio.status === 'on' || radio.status === 'tuning';
  const { track, label, ticker } = useTicker(text);

  return (
    <section className="player panel" aria-label="Radio">
      <div className="lcd" aria-live="polite">
        <div className="lcd-track" ref={track}>
          <span
            // Keyed on the text so a new message starts its scroll afresh.
            key={text}
            ref={label}
            // Short status messages ("TUNING IN...") sit still and blink, like a real display waiting.
            className={`lcd-text${ticker.scroll ? ' scrolling' : radio.status === 'on' ? '' : ' blink'}`}
            style={
              ticker.scroll
                ? ({ '--from': `${ticker.from}px`, '--to': `${ticker.to}px`, animationDuration: `${ticker.duration}s`, animationDelay: `${ticker.delay}s` } as React.CSSProperties)
                : undefined
            }
          >
            {text}
          </span>
        </div>
      </div>
      <div className="player-controls">
        <button className="icon-button" onClick={radio.toggle} aria-label={playing ? 'Pause' : 'Play'}>
          <Icon name={playing ? 'pause' : 'play'} size={32} />
        </button>
        <div className={radio.muted ? 'volume muted' : 'volume'}>
          <button className="icon-button" onClick={radio.toggleMute} aria-label={radio.muted ? 'Unmute' : 'Mute'} aria-pressed={radio.muted}>
            <Icon name={radio.muted ? 'volumeOff' : 'volumeDown'} />
          </button>
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
        </div>
      </div>
    </section>
  );
}
