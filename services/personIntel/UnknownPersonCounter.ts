// @ts-nocheck
/**
 * UnknownPersonCounter
 *
 * Persistent sequential ID counter for anonymous persons detected on camera.
 * IDs are formatted as UNK-0001, UNK-0002, … and stored in .data/unk_counter.json
 * so they survive server restarts and remain unique across the full deployment lifetime.
 */

import fs from 'fs';
import path from 'path';

const COUNTER_PATH = path.resolve('.data', 'unk_counter.json');

// In-memory lock to prevent race conditions between concurrent detections
let lock = Promise.resolve();

function readCounter(): number {
  try {
    if (!fs.existsSync(COUNTER_PATH)) return 0;
    const raw = fs.readFileSync(COUNTER_PATH, 'utf8');
    const data = JSON.parse(raw);
    return typeof data.counter === 'number' ? data.counter : 0;
  } catch {
    return 0;
  }
}

function writeCounter(value: number): void {
  try {
    const dir = path.dirname(COUNTER_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(COUNTER_PATH, JSON.stringify({ counter: value }), 'utf8');
  } catch (err) {
    console.warn('[UnknownPersonCounter] Failed to persist counter:', err);
  }
}

/**
 * Returns the next unique sequential ID for an anonymous person.
 * Format: UNK-0001, UNK-0002, …, UNK-9999, UNK-10000, …
 * Thread-safe via a promise-based lock (single Node.js process).
 */
export function getNextUnknownPersonId(): Promise<string> {
  lock = lock.then(() => {
    const next = readCounter() + 1;
    writeCounter(next);
    return `UNK-${String(next).padStart(4, '0')}`;
  });
  return lock as Promise<string>;
}

/**
 * Peek the current counter value without incrementing.
 */
export function currentUnknownCount(): number {
  return readCounter();
}
