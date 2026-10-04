// Lifetime stats, kept in this browser only. Guess FM has no accounts or server.

export interface RoundResult {
  won: boolean;
  distances: number[]; // km from each guess's pin to the station, in order
}

interface Stored {
  games: number;
  rounds: number;
  roundsWon: number;
  guesses: number;
  firstGuessKm: number; // sum over rounds
}

const KEY = 'guess-fm:stats';
const EMPTY: Stored = { games: 0, rounds: 0, roundsWon: 0, guesses: 0, firstGuessKm: 0 };

function read(): Stored {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return EMPTY;
  }
}

export function recordGame(rounds: RoundResult[]) {
  const s = read();
  s.games++;
  for (const r of rounds) {
    s.rounds++;
    if (r.won) s.roundsWon++;
    s.guesses += r.distances.length;
    s.firstGuessKm += r.distances[0] ?? 0;
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // private browsing etc. — stats just don't persist
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function lifetimeStats() {
  const s = read();
  return {
    games: s.games,
    roundsWon: s.roundsWon,
    roundsLost: s.rounds - s.roundsWon,
    guessesPerRound: s.rounds ? round2(s.guesses / s.rounds) : 0,
    guesses: s.guesses,
    percentWon: s.rounds ? round2((s.roundsWon / s.rounds) * 100) : 0,
    firstGuessKm: s.rounds ? Math.round(s.firstGuessKm / s.rounds) : 0,
  };
}

export function gameStats(rounds: RoundResult[]) {
  const distances = rounds.flatMap((r) => r.distances);
  return {
    score: rounds.filter((r) => r.won).length,
    averageKm: distances.length ? Math.round(distances.reduce((a, b) => a + b, 0) / distances.length) : 0,
    averageGuesses: rounds.length ? round2(distances.length / rounds.length) : 0,
  };
}
