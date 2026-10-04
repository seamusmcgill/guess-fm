import { useCallback, useEffect, useRef, useState } from 'react';
import { direction, distanceKm, type Direction } from '../lib/geo';
import type { Station } from '../lib/radioBrowser';
import { coords, pickRounds, type RoundStations } from '../lib/stations';
import { recordGame, type RoundResult } from '../lib/stats';
import { countryAt, type Coords, type World } from '../lib/world';
import type { Radio } from './useRadio';

export const ROUNDS = 3;
export const GUESSES_PER_ROUND = 5;
// Pause after the last guess of a round so it shows in the results panel before the dialog.
const ROUND_END_DELAY_MS = 600;

export type Phase = 'welcome' | 'announce' | 'playing' | 'over';

export interface Guess {
  country: string;
  km: number;
  direction: Direction;
  correct: boolean;
}

export interface RoundSummary {
  station: Station;
  country: string;
  guesses: Guess[];
}

export function useGame(world: World | null, radio: Radio) {
  const [phase, setPhase] = useState<Phase>('welcome');
  const [round, setRound] = useState(0); // 0-based
  const [rounds, setRounds] = useState<RoundStations[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [summary, setSummary] = useState<RoundSummary | null>(null);
  const [pin, setPin] = useState<Coords | null>(null);
  const [onLand, setOnLand] = useState(true);
  const ending = useRef(false);
  const upcoming = useRef<Promise<RoundStations[]>>(null);

  // Stations for the next game are fetched ahead of time, while the player reads a dialog.
  const prefetch = useCallback(() => {
    if (!world || upcoming.current) return;
    upcoming.current = pickRounds(world, ROUNDS);
    upcoming.current.catch(() => {});
  }, [world]);

  useEffect(prefetch, [prefetch]);

  const deal = useCallback(() => {
    if (!world) return;
    const next = upcoming.current ?? pickRounds(world, ROUNDS);
    upcoming.current = null;
    setRounds(null);
    setLoadFailed(false);
    next.then(setRounds, () => setLoadFailed(true));
  }, [world]);

  const newGame = useCallback(() => {
    radio.stop();
    setRound(0);
    setResults([]);
    setGuesses([]);
    setSummary(null);
    setPin(null);
    setPhase('announce');
    deal();
  }, [radio, deal]);

  const startRound = useCallback(() => {
    if (!rounds) return;
    ending.current = false;
    setGuesses([]);
    setPin(null);
    setOnLand(true);
    setPhase('playing');
    radio.tune(rounds[round].stations, round + 1);
  }, [rounds, round, radio]);

  const dropPin = useCallback((at: Coords) => {
    if (phase !== 'playing' || ending.current) return;
    setPin(at);
    setOnLand(true);
  }, [phase]);

  const guess = useCallback(() => {
    if (phase !== 'playing' || ending.current || !pin || !world || !rounds) return;
    const country = countryAt(world, pin);
    if (!country) {
      setOnLand(false);
      return;
    }
    // Measure to whichever station is actually on air: it may be a stand-in for one that wouldn't play.
    const station = radio.station ?? rounds[round].stations[0];
    const target = coords(station);
    const correct = country === rounds[round].country;
    const g: Guess = { country, km: Math.round(distanceKm(pin, target)), direction: direction(pin, target), correct };
    const all = [...guesses, g];
    setGuesses(all);
    if (!correct && all.length < GUESSES_PER_ROUND) return;

    ending.current = true;
    const done = [...results, { won: correct, distances: all.map((x) => x.km) }];
    setResults(done);
    setSummary({ station, country: rounds[round].country, guesses: all });
    setTimeout(() => {
      radio.stop();
      if (done.length < ROUNDS) {
        setRound(done.length);
        setPhase('announce');
      } else {
        recordGame(done);
        setPhase('over');
        prefetch();
      }
    }, ROUND_END_DELAY_MS);
  }, [phase, pin, world, rounds, round, guesses, results, radio, prefetch]);

  return {
    phase,
    round,
    ready: rounds != null,
    loadFailed,
    retry: deal,
    guesses,
    results,
    score: results.filter((r) => r.won).length,
    summary,
    pin,
    onLand,
    newGame,
    startRound,
    dropPin,
    guess,
  };
}

export type Game = ReturnType<typeof useGame>;
