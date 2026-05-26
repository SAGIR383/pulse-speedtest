'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { runSpeedTestClient, type ClientRunHandle } from '../engine/runner';
import {
  detectLocation,
  detectIsp,
  buildNearbyNodes,
  pickBestServer,
} from '../engine/location';
import { saveResult } from '../db/history';
import { buildDiagnostics } from '../ai/diagnostics';
import type {
  LiveState,
  TestResult,
  LocationInfo,
  ServerInfo,
  Diagnostics,
} from '../engine/types';

// The app uses same-origin Next.js API routes by default (zero extra infra).
// Optionally, point at a standalone telemetry server via env var.
const ORIGIN = process.env.NEXT_PUBLIC_TELEMETRY_ORIGIN?.replace(/\/$/, '') ?? '';

const ENDPOINTS = {
  ping: `${ORIGIN}/api/ping`,
  download: `${ORIGIN}/api/download`,
  upload: `${ORIGIN}/api/upload`,
};

const initialLive: LiveState = {
  phase: 'idle',
  progress: 0,
  current: 0,
  download: 0,
  upload: 0,
  ping: 0,
  jitter: 0,
  packetLoss: 0,
  samples: [],
  latencySamples: [],
};

export function useSpeedTest() {
  const [live, setLive] = useState<LiveState>(initialLive);
  const [result, setResult] = useState<TestResult | null>(null);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [location, setLocation] = useState<LocationInfo | null>(null);
  const [isp, setIsp] = useState<string | null>(null);
  const [nodes, setNodes] = useState<ServerInfo[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runRef = useRef<ClientRunHandle | null>(null);

  // Detect location + ISP on mount (non-blocking).
  useEffect(() => {
    let mounted = true;
    (async () => {
      const [loc, ispName] = await Promise.all([detectLocation(), detectIsp()]);
      if (!mounted) return;
      setLocation(loc);
      setIsp(ispName);
      setNodes(buildNearbyNodes(loc));
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const requestPreciseLocation = useCallback(async () => {
    const loc = await detectLocation();
    setLocation(loc);
    setNodes(buildNearbyNodes(loc));
    return loc;
  }, []);

  const start = useCallback(async () => {
    if (isRunning) return;
    setError(null);
    setResult(null);
    setDiagnostics(null);
    setIsRunning(true);

    const currentNodes = nodes.length ? nodes : buildNearbyNodes(location);
    const server = pickBestServer(currentNodes);

    try {
      const handle = runSpeedTestClient({
        endpoints: ENDPOINTS,
        server,
        location,
        isp,
        onState: (s) => setLive(s),
      });
      runRef.current = handle;

      const res = await handle.promise;
      setResult(res);
      setDiagnostics(buildDiagnostics(res));
      await saveResult(res);
    } catch (e) {
      const aborted =
        e instanceof DOMException && e.name === 'AbortError';
      if (!aborted) {
        setError(e instanceof Error ? e.message : 'Test failed');
        setLive((prev) => ({ ...prev, phase: 'error' }));
      }
    } finally {
      setIsRunning(false);
      runRef.current = null;
    }
  }, [isRunning, nodes, location, isp]);

  const cancel = useCallback(() => {
    runRef.current?.cancel();
    setIsRunning(false);
    setLive(initialLive);
  }, []);

  const reset = useCallback(() => {
    setLive(initialLive);
    setResult(null);
    setDiagnostics(null);
    setError(null);
  }, []);

  return {
    live,
    result,
    diagnostics,
    location,
    isp,
    nodes,
    isRunning,
    error,
    start,
    cancel,
    reset,
    requestPreciseLocation,
  };
}
