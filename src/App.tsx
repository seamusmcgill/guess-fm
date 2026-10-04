import { useEffect, useState } from 'react';
import { About, Announcement, GameOver, Instructions, LifetimeStats } from './components/GameDialogs';
import Icon from './components/Icon';
import Player from './components/Player';
import Results from './components/Results';
import WorldMap from './components/WorldMap';
import { useGame } from './hooks/useGame';
import { useRadio } from './hooks/useRadio';
import { loadWorld, type World } from './lib/world';

export default function App() {
  const [world, setWorld] = useState<World | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const radio = useRadio();
  const game = useGame(world, radio);

  useEffect(() => {
    loadWorld().then(setWorld);
  }, []);

  return (
    <div className="app">
      <header className="navbar">
        <h1 className="logo glow">GUESS FM</h1>
        <nav>
          <button className="icon-button" aria-label="Lifetime statistics" onClick={() => setStatsOpen(true)}>
            <Icon name="barChart" />
          </button>
          <button className="icon-button" aria-label="About" onClick={() => setAboutOpen(true)}>
            <Icon name="info" />
          </button>
        </nav>
      </header>

      <WorldMap world={world} pin={game.pin} onPin={game.dropPin} />

      <Player radio={radio} round={game.round} />
      <Results guesses={game.guesses} score={game.score} />
      <section className="guess-panel panel">
        {!game.onLand && <p className="hint">That’s the ocean! Drop your pin on a country.</p>}
        <button className="btn guess" disabled={game.phase !== 'playing' || !game.pin} onClick={game.guess}>
          GUESS
        </button>
      </section>

      <Instructions open={game.phase === 'welcome'} ready={world != null} onPlay={game.newGame} />
      <Announcement game={game} />
      <GameOver game={game} />
      <LifetimeStats open={statsOpen} onClose={() => setStatsOpen(false)} />
      <About open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  );
}
