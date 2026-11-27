import { useEffect, useState } from 'react';
import { ROUNDS, type Game, type RoundSummary } from '../hooks/useGame';
import { getStats } from '../lib/radioBrowser';
import { gameStats, lifetimeStats } from '../lib/stats';
import { countryName } from '../lib/world';
import Dialog, { Spinner, Stat } from './Dialog';
import Icon from './Icon';

const STEPS = [
  'A random radio station from around the world will play.',
  'Drop a pin in the country you think it’s from.',
  'Use the guess button to submit your answer.',
  'Distance and direction hints show after each wrong guess.',
  `There are ${ROUNDS} rounds in a game.`,
];

export function Instructions({ open, ready, onPlay }: { open: boolean; ready: boolean; onPlay: () => void }) {
  return (
    <Dialog open={open} title="WELCOME TO GUESS FM" width="md" actions={ready ? <button className="btn" onClick={onPlay}>PLAY NOW</button> : <Spinner />}>
      <ol className="steps">
        {STEPS.map((s, i) => (
          <li key={s}>
            <span aria-hidden="true">{`${i + 1}️⃣`}</span>
            {s}
          </li>
        ))}
      </ol>
    </Dialog>
  );
}

function RoundRecap({ summary }: { summary: RoundSummary }) {
  const { station, country, city, guesses } = summary;
  const last = guesses[guesses.length - 1];
  // The city if we could name one, otherwise the region the station filed itself under.
  const where = city ?? (station.state && station.state.toLowerCase() !== countryName(country).toLowerCase() ? station.state : null);
  return (
    <>
      <p>
        The correct answer was <strong>{countryName(country)}</strong>.{' '}
        {last.correct && `You got it in ${guesses.length} ${guesses.length === 1 ? 'guess' : 'guesses'}.`}
      </p>
      <dl className="recap">
        <dt>STATION</dt>
        <dd>{station.homepage ? <a href={station.homepage} target="_blank" rel="noreferrer">{station.name.trim()}</a> : station.name.trim()}</dd>
        <dt>LOCATION</dt>
        <dd>{where ? `${where}, ${countryName(country)}` : countryName(country)}</dd>
        <dt>DISTANCE</dt>
        <dd>{last.km.toLocaleString('en-US')} km from your pin</dd>
      </dl>
    </>
  );
}

// A short beat before START, like the original, so a double-click on GUESS doesn't skip the recap.
function StartButton({ ready, onStart, children }: { ready: boolean; onStart: () => void; children: string }) {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setSettled(true), 1000);
    return () => clearTimeout(id);
  }, []);
  return ready && settled ? <button className="btn" onClick={onStart}>{children}</button> : <Spinner />;
}

export function Announcement({ game }: { game: Game }) {
  const { round, summary, ready, loadFailed } = game;
  const title = round === 0 || !summary ? `ROUND ${round + 1}` : summary.guesses.at(-1)!.correct ? 'NICE ONE!' : 'OOPS... NOT QUITE';
  const action = loadFailed ? (
    <button className="btn" onClick={game.retry}>TRY AGAIN</button>
  ) : (
    <StartButton key={`${game.phase}-${round}`} ready={ready} onStart={game.startRound}>
      {round === 0 ? 'START' : `START ROUND ${round + 1}`}
    </StartButton>
  );

  return (
    <Dialog open={game.phase === 'announce'} title={title} width={round > 0 || loadFailed ? 'sm' : 'xs'} slide actions={action}>
      {round > 0 && summary && <RoundRecap summary={summary} />}
      {loadFailed && <p>Couldn’t reach the radio directory. Check your connection and try again.</p>}
    </Dialog>
  );
}

export function GameOver({ game }: { game: Game }) {
  const stats = gameStats(game.results);
  return (
    <Dialog open={game.phase === 'over'} title="GAME OVER" actions={<button className="btn" onClick={game.newGame}>PLAY AGAIN</button>}>
      <details name="final" open>
        <summary>
          FINAL ROUND RESULTS <Icon name="expand" />
        </summary>
        <div className="details-body">{game.summary && <RoundRecap summary={game.summary} />}</div>
      </details>
      <details name="final">
        <summary>
          GAME STATISTICS <Icon name="expand" />
        </summary>
        <div className="details-body stats">
          <Stat value={`${stats.score}/${ROUNDS}`} label="Total Score" />
          <Stat value={`${stats.averageKm} km`} label="Average Distance" />
          <Stat value={stats.averageGuesses} label="Average Guesses" />
        </div>
      </details>
    </Dialog>
  );
}

export function LifetimeStats({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = lifetimeStats();
  return (
    <Dialog open={open} title="LIFETIME STATISTICS" onClose={onClose}>
      <div className="stats">
        <Stat value={s.games} label="TOTAL GAMES" />
        <Stat value={`${s.roundsWon} - ${s.roundsLost}`} label="ROUNDS WON/LOST" />
        <Stat value={s.guessesPerRound} label="AVG GUESS PER ROUND" />
        <Stat value={s.guesses} label="TOTAL GUESSES" />
        <Stat value={`${s.percentWon}%`} label="ROUNDS WON PERCENT" />
        <Stat value={`${s.firstGuessKm} km`} label="AVG 1ST GUESS DISTANCE" />
      </div>
    </Dialog>
  );
}

export function About({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [stats, setStats] = useState<{ stations: number; countries: number; languages: number }>();
  useEffect(() => {
    if (open && !stats) getStats().then(setStats, () => {});
  }, [open, stats]);
  const n = (v?: number) => (v == null ? '—' : v.toLocaleString('en-US'));

  return (
    <Dialog open={open} title="GUESS FM" onClose={onClose}>
      <p>
        Stations come from <a href="https://www.radio-browser.info" target="_blank" rel="noreferrer">Radio Browser</a>, a free, community-run
        directory of internet radio. Every stream plays straight from its broadcaster.
      </p>
      <div className="stats">
        <Stat value={n(stats?.stations)} label="STATIONS" />
        <Stat value={n(stats?.countries)} label="COUNTRIES" />
        <Stat value={n(stats?.languages)} label="LANGUAGES" />
      </div>
      <p className="credits">
        Guess FM was built by <a href="https://github.com/andrewlpmcneill">Andrew McNeill</a>, <a href="https://github.com/ryjcm1">Jimmy Chuk</a>, and{' '}
        <a href="https://github.com/seamusmcgill">Seamus McGill</a>. Map data from <a href="https://www.naturalearthdata.com">Natural Earth</a>.
      </p>
      <p className="credits">
        LCD font © 1977, 1999 Samuel Reynolds (<a href="http://www.spinwardstars.com/scrfonts/">spinwardstars.com/scrfonts</a>). Wild World font by{' '}
        <a href="https://www.behance.net/abdullahneon">Abdullah Mosad</a>.
      </p>
    </Dialog>
  );
}
