import { GUESSES_PER_ROUND, ROUNDS, type Guess } from '../hooks/useGame';
import type { Direction } from '../lib/geo';
import { countryName } from '../lib/world';
import Icon from './Icon';

const ROTATION: Record<Direction, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };

function Row({ guess }: { guess?: Guess }) {
  return (
    <li>
      <span>{guess && countryName(guess.country)}</span>
      <span>{guess && (guess.correct ? <Icon name="check" /> : `${guess.km}km`)}</span>
      <span>{guess && (guess.correct ? <Icon name="celebration" /> : <Icon name="north" rotate={ROTATION[guess.direction]} />)}</span>
    </li>
  );
}

export default function Results({ guesses, score }: { guesses: Guess[]; score: number }) {
  return (
    <section className="results" aria-label="Guesses and score">
      <h3>GUESSES</h3>
      <ol className="guesses">
        {Array.from({ length: GUESSES_PER_ROUND }, (_, i) => (
          <Row key={i} guess={guesses[i]} />
        ))}
      </ol>
      <h3 className="score-title">SCORE</h3>
      <p className="score">
        {score}<span>/</span>{ROUNDS}
      </p>
    </section>
  );
}
