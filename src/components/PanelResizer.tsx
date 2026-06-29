'use client';

import { useRef } from 'react';
import { clampPanelWidth, MIN_PANEL_WIDTH, MAX_PANEL_WIDTH } from '../lib/panelLayout';

const KEYBOARD_STEP = 16;

export function PanelResizer({
  width,
  onResize,
  onCommit,
}: {
  width: number;
  onResize: (w: number) => void;
  onCommit: (w: number) => void;
}) {
  const drag = useRef<{ startX: number; startWidth: number; latest: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startWidth: width, latest: width };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const next = clampPanelWidth(d.startWidth + (e.clientX - d.startX));
    d.latest = next;
    onResize(next);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    onCommit(d.latest);
    drag.current = null;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    if (e.key === 'ArrowLeft') next = clampPanelWidth(width - KEYBOARD_STEP);
    else if (e.key === 'ArrowRight') next = clampPanelWidth(width + KEYBOARD_STEP);
    if (next === null) return;
    e.preventDefault();
    onResize(next);
    onCommit(next);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panel"
      aria-valuemin={MIN_PANEL_WIDTH}
      aria-valuemax={MAX_PANEL_WIDTH}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      className="absolute top-0 -right-[3px] z-10 hidden h-full w-1.5 cursor-col-resize touch-none hover:bg-brand/20 focus-visible:bg-brand/30 focus-visible:outline-none lg:block"
    />
  );
}
