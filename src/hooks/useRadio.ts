import { useCallback, useEffect, useRef, useState } from 'react';
import { reportPlay, streamUrl, type Station } from '../lib/radioBrowser';

// How long a stream gets to start before we move on to the next station in the country.
const TUNE_TIMEOUT_MS = 10000;

export type RadioStatus = 'off' | 'tuning' | 'on' | 'paused' | 'blocked' | 'dead';

export function useRadio() {
  const audio = useRef<HTMLAudioElement>(null);
  const queue = useRef<Station[]>([]);
  const index = useRef(0);
  const watchdog = useRef(0);
  const reported = useRef<string>(null);
  const [station, setStation] = useState<Station | null>(null);
  const [status, setStatus] = useState<RadioStatus>('off');
  const [volume, setVolumeState] = useState(30);
  const [muted, setMuted] = useState(false);

  audio.current ??= new Audio();

  const tryStation = useCallback(function tryAt(i: number) {
    const el = audio.current!;
    // A dead stream can report itself more than once (error event, rejected play(), watchdog);
    // only the first report for the station that's actually loaded moves us on.
    const next = () => {
      if (index.current === i) tryAt(i + 1);
    };
    clearTimeout(watchdog.current);
    index.current = i;
    const s = queue.current[i];
    if (!s) {
      setStatus('dead');
      return;
    }
    setStation(s);
    setStatus('tuning');
    el.src = streamUrl(s);
    el.play().catch((err: DOMException) => {
      // Autoplay blocked: the stream is fine, the listener just has to press play.
      if (err.name === 'NotAllowedError') {
        clearTimeout(watchdog.current);
        setStatus('blocked');
      } else if (err.name !== 'AbortError') next();
    });
    watchdog.current = window.setTimeout(next, TUNE_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    const el = audio.current!;
    const onPlaying = () => {
      clearTimeout(watchdog.current);
      setStatus('on');
      const s = queue.current[index.current];
      if (s && reported.current !== s.stationuuid) {
        reported.current = s.stationuuid;
        reportPlay(s);
      }
    };
    const onError = () => {
      if (el.getAttribute('src')) tryStation(index.current + 1);
    };
    el.addEventListener('playing', onPlaying);
    el.addEventListener('error', onError);
    return () => {
      el.removeEventListener('playing', onPlaying);
      el.removeEventListener('error', onError);
      clearTimeout(watchdog.current);
      el.pause();
    };
  }, [tryStation]);

  // Plays the first station that works. The rest are stand-ins from the same country.
  const tune = useCallback((stations: Station[], round: number) => {
    queue.current = stations;
    // Keep the station name out of the OS media controls, or it'd give the answer away.
    if ('mediaSession' in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: 'Guess FM', artist: `Round ${round}` });
    tryStation(0);
  }, [tryStation]);

  const stop = useCallback(() => {
    const el = audio.current!;
    clearTimeout(watchdog.current);
    el.pause();
    el.removeAttribute('src');
    el.load();
    setStatus('off');
  }, []);

  // Pausing live radio and resuming would play stale buffer, so resuming re-requests the stream.
  const toggle = useCallback(() => {
    const el = audio.current!;
    if (status === 'on' || status === 'tuning') {
      clearTimeout(watchdog.current);
      el.pause();
      setStatus('paused');
    } else if (queue.current.length) {
      tryStation(status === 'dead' ? 0 : index.current);
    }
  }, [status, tryStation]);

  useEffect(() => {
    audio.current!.volume = muted ? 0 : volume / 100;
  }, [volume, muted]);

  const setVolume = useCallback((v: number) => {
    setMuted(false);
    setVolumeState(v);
  }, []);

  // Media keys on the keyboard.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.setActionHandler('play', toggle);
    navigator.mediaSession.setActionHandler('pause', toggle);
  }, [toggle]);

  return { station, status, volume, muted, tune, stop, toggle, setVolume, toggleMute: () => setMuted((m) => !m) };
}

export type Radio = ReturnType<typeof useRadio>;
