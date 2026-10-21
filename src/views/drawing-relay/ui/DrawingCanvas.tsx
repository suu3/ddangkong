'use client';
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import { RELAY_COLORS, type Drawing, type Stroke } from '@/src/shared/lib/drawing-relay';
import { extendDrawing, normalisePoint, renderDrawing } from '../model/canvas';
import styles from './drawing-relay.module.css';
const COLOR_NAMES = ['초콜릿', '빨강', '노랑', '초록', '파랑', '보라'];
function ToolIcon({ kind }: { kind: 'pen' | 'eraser' | 'undo' }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {kind === 'pen' && (
        <>
          <path d="m4 16-1 5 5-1L20 8a2.8 2.8 0 0 0-4-4Z" />
          <path d="m14 6 4 4M4 16l4 4" />
        </>
      )}
      {kind === 'eraser' && (
        <>
          <path d="m4 13 8-9a2 2 0 0 1 3 0l5 5a2 2 0 0 1 0 3l-8 9H9l-5-5a2 2 0 0 1 0-3Z" />
          <path d="m8 9 8 8M12 21h9" />
        </>
      )}
      {kind === 'undo' && (
        <>
          <path d="m9 5-5 5 5 5" />
          <path d="M4 10h9a7 7 0 0 1 7 7v2" />
        </>
      )}
    </svg>
  );
}
export default function DrawingCanvas({
  value,
  onChange,
  disabled = false,
  readOnly = false,
}: {
  value: Drawing;
  onChange?: (drawing: Drawing) => void;
  disabled?: boolean;
  readOnly?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const current = useRef(value);
  useLayoutEffect(() => {
    current.current = value;
  }, [value]);
  const pointer = useRef<number | null>(null);
  const [color, setColor] = useState<string>(RELAY_COLORS[0]);
  const [tool, setTool] = useState<Stroke['tool']>('pen');
  const [hint, setHint] = useState('');
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (ctx) renderDrawing(ctx, value, 1024);
  }, [value]);
  useEffect(() => {
    if (disabled) pointer.current = null;
  }, [disabled]);
  function draw(event: PointerEvent<HTMLCanvasElement>, start: boolean) {
    if (disabled || readOnly || !onChange) return;
    if (start) {
      if (pointer.current !== null) return;
      pointer.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
    } else if (pointer.current !== event.pointerId) return;
    const point = normalisePoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
    const last = current.current.strokes.at(-1)?.points.at(-1);
    if (!start && last && Math.hypot(point[0] - last[0], point[1] - last[1]) < 0.004) return;
    const next = extendDrawing(
      current.current,
      { tool, color, width: tool === 'eraser' ? 0.055 : 0.012, points: [point] },
      start
    );
    if (!next) {
      setHint('종이가 꽉 찼어요. 되돌리기로 조금 지워 주세요.');
      return;
    }
    current.current = next;
    onChange(next);
    setHint('');
  }
  return (
    <div className={styles.drawing}>
      <canvas
        ref={canvas}
        width={1024}
        height={1024}
        aria-label={readOnly ? '전달된 그림' : '그림 그리는 종이'}
        role="img"
        className={readOnly ? styles.preview : styles.canvas}
        onPointerDown={e => draw(e, true)}
        onPointerMove={e => draw(e, false)}
        onPointerUp={e => {
          if (pointer.current === e.pointerId) pointer.current = null;
        }}
        onPointerCancel={() => {
          pointer.current = null;
        }}
        onLostPointerCapture={() => {
          pointer.current = null;
        }}
      />
      {!readOnly && (
        <>
          <div className={styles.palette} aria-label="그림 색상">
            {RELAY_COLORS.map((c, i) => (
              <button
                key={c}
                type="button"
                disabled={disabled}
                aria-label={COLOR_NAMES[i]}
                aria-pressed={color === c && tool === 'pen'}
                onClick={() => {
                  setColor(c);
                  setTool('pen');
                }}
                className={styles.swatch}
              >
                <span style={{ backgroundColor: c }} />
                {color === c && tool === 'pen' && <span className={styles.check}>✓</span>}
              </button>
            ))}
          </div>
          <div className={styles.tools}>
            <button type="button" disabled={disabled} aria-pressed={tool === 'pen'} onClick={() => setTool('pen')}>
              <ToolIcon kind="pen" />
              <span>연필</span>
            </button>
            <button
              type="button"
              disabled={disabled}
              aria-pressed={tool === 'eraser'}
              onClick={() => setTool('eraser')}
            >
              <ToolIcon kind="eraser" />
              <span>지우개</span>
            </button>
            <button
              type="button"
              disabled={disabled || !value.strokes.length}
              onClick={() => {
                pointer.current = null;
                onChange?.({ strokes: value.strokes.slice(0, -1) });
                setHint('');
              }}
            >
              <ToolIcon kind="undo" />
              <span>되돌리기</span>
            </button>
          </div>
          {hint && (
            <p role="status" className={styles.hint}>
              {hint}
            </p>
          )}
        </>
      )}
    </div>
  );
}
