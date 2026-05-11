import { describe, it, expect } from 'vitest';

// ── Inline the pure timeline utility functions ────────────────────────────────
// (mirrors TimelinePanel.vue logic without Vue/Pinia deps)

function msToX(ms: number, totalDurationMs: number, timelineWidth: number): number {
  return (ms / totalDurationMs) * (timelineWidth - 40) + 20;
}

function xToMs(x: number, totalDurationMs: number, timelineWidth: number): number {
  return Math.max(0, Math.min(totalDurationMs, ((x - 20) / (timelineWidth - 40)) * totalDurationMs));
}

function computeTimelineWidth(totalDurationMs: number, zoomPxPerSec: number): number {
  return Math.max(600, Math.ceil(totalDurationMs / 1000) * zoomPxPerSec + 80);
}

// Resize-left: end stays fixed, start changes
function applyResizeLeft(
  originalStartMs: number,
  originalDurationMs: number,
  dx: number,
  totalDurationMs: number,
  timelineWidth: number,
): { startMs: number; durationMs: number } {
  const dms = (dx / (timelineWidth - 40)) * totalDurationMs;
  const endMs = originalStartMs + originalDurationMs;
  const newStart = Math.max(0, Math.min(endMs - 100, originalStartMs + dms));
  return { startMs: Math.round(newStart), durationMs: Math.round(endMs - newStart) };
}

// Resize-right: start stays fixed, end changes
function applyResizeRight(
  originalStartMs: number,
  originalDurationMs: number,
  dx: number,
  totalDurationMs: number,
  timelineWidth: number,
): { durationMs: number } {
  const dms = (dx / (timelineWidth - 40)) * totalDurationMs;
  const maxDuration = totalDurationMs - originalStartMs;
  return { durationMs: Math.round(Math.max(100, Math.min(maxDuration, originalDurationMs + dms))) };
}

// Drag-move: both start and end shift together
function applyMove(
  originalStartMs: number,
  originalDurationMs: number,
  dx: number,
  totalDurationMs: number,
  timelineWidth: number,
): { startMs: number } {
  const dms = (dx / (timelineWidth - 40)) * totalDurationMs;
  const newStart = Math.max(0, Math.min(totalDurationMs - originalDurationMs, originalStartMs + dms));
  return { startMs: Math.round(newStart) };
}

// ── msToX / xToMs ─────────────────────────────────────────────────────────────

describe('msToX', () => {
  const total = 5000;
  const width = 600;

  it('maps 0ms to left margin (20px)', () => {
    expect(msToX(0, total, width)).toBe(20);
  });

  it('maps totalDuration to right edge', () => {
    expect(msToX(total, total, width)).toBeCloseTo(width - 20);
  });

  it('maps midpoint to center of usable area', () => {
    const mid = msToX(total / 2, total, width);
    expect(mid).toBeCloseTo((width - 40) / 2 + 20);
  });
});

describe('xToMs', () => {
  const total = 5000;
  const width = 600;

  it('clamps x below left margin to 0ms', () => {
    expect(xToMs(0, total, width)).toBe(0);
    expect(xToMs(-100, total, width)).toBe(0);
  });

  it('clamps x beyond right edge to totalDurationMs', () => {
    expect(xToMs(9999, total, width)).toBe(total);
  });

  it('round-trips with msToX', () => {
    const ms = 2345;
    expect(xToMs(msToX(ms, total, width), total, width)).toBeCloseTo(ms, 0);
  });
});

describe('computeTimelineWidth', () => {
  it('returns at least 600px for short durations', () => {
    expect(computeTimelineWidth(1000, 100)).toBe(600);
  });

  it('grows with longer durations', () => {
    expect(computeTimelineWidth(10000, 100)).toBe(1080);
  });

  it('grows with higher zoom', () => {
    expect(computeTimelineWidth(5000, 200)).toBe(1080);
  });
});

// ── Resize-left ───────────────────────────────────────────────────────────────

describe('applyResizeLeft', () => {
  const total = 5000, width = 600;

  it('moving right shrinks duration from the left', () => {
    const orig = { startMs: 500, durationMs: 2000 };
    // px that corresponds to ~500ms
    const dx = msToX(1000, total, width) - msToX(500, total, width);
    const result = applyResizeLeft(orig.startMs, orig.durationMs, dx, total, width);
    expect(result.startMs).toBeCloseTo(1000, -1);
    // end should stay at 2500ms → new duration ≈ 1500ms
    expect(result.durationMs).toBeCloseTo(1500, -1);
  });

  it('cannot shrink duration below 100ms', () => {
    const orig = { startMs: 1000, durationMs: 200 };
    const bigRightDx = 999;
    const result = applyResizeLeft(orig.startMs, orig.durationMs, bigRightDx, total, width);
    expect(result.durationMs).toBeGreaterThanOrEqual(100);
  });

  it('cannot push start before 0ms', () => {
    const orig = { startMs: 0, durationMs: 1000 };
    const bigLeftDx = -999;
    const result = applyResizeLeft(orig.startMs, orig.durationMs, bigLeftDx, total, width);
    expect(result.startMs).toBe(0);
  });
});

// ── Resize-right ──────────────────────────────────────────────────────────────

describe('applyResizeRight', () => {
  const total = 5000, width = 600;

  it('moving right extends duration', () => {
    const orig = { startMs: 500, durationMs: 1000 };
    const dx = msToX(1500, total, width) - msToX(1000, total, width);
    const result = applyResizeRight(orig.startMs, orig.durationMs, dx, total, width);
    expect(result.durationMs).toBeCloseTo(1500, -1);
  });

  it('cannot shrink duration below 100ms', () => {
    const orig = { startMs: 1000, durationMs: 200 };
    const bigLeftDx = -999;
    const result = applyResizeRight(orig.startMs, orig.durationMs, bigLeftDx, total, width);
    expect(result.durationMs).toBe(100);
  });

  it('cannot extend beyond totalDurationMs', () => {
    const orig = { startMs: 4500, durationMs: 400 };
    const bigRightDx = 999;
    const result = applyResizeRight(orig.startMs, orig.durationMs, bigRightDx, total, width);
    expect(result.durationMs).toBe(total - orig.startMs);
  });
});

// ── Move (drag) ───────────────────────────────────────────────────────────────

describe('applyMove', () => {
  const total = 5000, width = 600;

  it('moves effect right', () => {
    const orig = { startMs: 500, durationMs: 1000 };
    const dx = msToX(1000, total, width) - msToX(500, total, width);
    const result = applyMove(orig.startMs, orig.durationMs, dx, total, width);
    expect(result.startMs).toBeCloseTo(1000, -1);
  });

  it('cannot move start before 0ms', () => {
    const orig = { startMs: 0, durationMs: 1000 };
    const result = applyMove(orig.startMs, orig.durationMs, -999, total, width);
    expect(result.startMs).toBe(0);
  });

  it('cannot move end past totalDurationMs', () => {
    const orig = { startMs: 4000, durationMs: 1000 };
    const result = applyMove(orig.startMs, orig.durationMs, 999, total, width);
    expect(result.startMs).toBe(total - orig.durationMs);
  });
});
