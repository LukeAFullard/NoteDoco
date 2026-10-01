/** Measurements collected by the ink lab, for the spike report (P0.7). */

export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))]!;
}

const round = (n: number | null, d = 1) => (n === null ? null : Math.round(n * 10 ** d) / 10 ** d);

export class InkMetrics {
  latencies: number[] = []; // event timestamp -> frame painted, ms
  renderMs: number[] = []; // wet-layer paint cost per frame, ms
  sampleRates: number[] = []; // per stroke: samples per second
  eventRates: number[] = []; // per stroke: move events per second
  pointerTypes: Record<string, number> = {};
  pressureMin = Infinity;
  pressureMax = -Infinity;
  tiltSeen = false;
  twistSeen = false;
  hoverSeen = false;
  penButtonsSeen = new Set<number>();
  gestureUndo = 0;
  gestureRedo = 0;
  strokes = 0;
  points = 0;
  encodedBytes = 0;

  reset() {
    Object.assign(this, new InkMetrics());
  }

  notePointer(e: PointerEvent) {
    if (e.pointerType === 'pen') {
      if (e.buttons) this.penButtonsSeen.add(e.buttons);
      if (e.pressure > 0) {
        this.pressureMin = Math.min(this.pressureMin, e.pressure);
        this.pressureMax = Math.max(this.pressureMax, e.pressure);
      }
      const alt = (e as PointerEvent & { altitudeAngle?: number }).altitudeAngle;
      if (e.tiltX || e.tiltY || (alt !== undefined && Math.abs(alt - Math.PI / 2) > 0.01)) this.tiltSeen = true;
      if (e.twist) this.twistSeen = true;
    }
  }

  noteStroke(samples: number, events: number, durationMs: number) {
    if (durationMs < 120 || samples < 4) return; // too short to measure a rate
    this.sampleRates.push((samples / durationMs) * 1000);
    this.eventRates.push((events / durationMs) * 1000);
  }

  noteLatency(ms: number) {
    if (this.latencies.length > 5000) this.latencies.shift();
    this.latencies.push(ms);
  }

  noteRender(ms: number) {
    if (this.renderMs.length > 5000) this.renderMs.shift();
    this.renderMs.push(ms);
  }

  summary() {
    return {
      strokes: this.strokes,
      points: this.points,
      bytesPerPoint: this.points ? round(this.encodedBytes / this.points, 2) : null,
      pointerTypes: this.pointerTypes,
      penSampleRateHz: round(percentile(this.sampleRates, 50), 0),
      moveEventsPerSec: round(percentile(this.eventRates, 50), 0),
      eventToFrameMs: { p50: round(percentile(this.latencies, 50)), p95: round(percentile(this.latencies, 95)) },
      wetPaintMs: { p50: round(percentile(this.renderMs, 50), 2), p95: round(percentile(this.renderMs, 95), 2) },
      pressure: this.pressureMax >= 0 ? { min: round(this.pressureMin, 3), max: round(this.pressureMax, 3) } : null,
      tiltSeen: this.tiltSeen,
      twistSeen: this.twistSeen,
      hoverSeen: this.hoverSeen,
      penButtonsSeen: [...this.penButtonsSeen],
      twoFingerUndo: this.gestureUndo,
      threeFingerRedo: this.gestureRedo,
    };
  }
}
