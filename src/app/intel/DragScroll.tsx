'use client';

import { useRef, type ComponentPropsWithoutRef } from 'react';
import styles from './page.module.css';

export default function DragScroll({ children, className, ...props }: ComponentPropsWithoutRef<'div'>) {
  const gesture = useRef<{ pointer: number; x: number; scroll: number; dragging: boolean } | null>(null);
  const suppressClick = useRef(false);

  function finish(element: HTMLDivElement, pointer: number) {
    gesture.current = null;
    delete element.dataset.dragging;
    if (element.hasPointerCapture(pointer)) element.releasePointerCapture(pointer);
  }

  return <div {...props} className={[styles.scroll, styles.dragScroll, className].filter(Boolean).join(' ')} data-drag-scroll="" tabIndex={props.tabIndex ?? 0}
    onPointerDown={event => {
      suppressClick.current = false;
      const element = event.currentTarget;
      if (event.pointerType !== 'mouse' || event.button !== 0 || element.scrollWidth <= element.clientWidth) return;
      const target = event.target as HTMLElement;
      if (target.closest('[data-drag-scroll]') !== element || target.closest('input, select, textarea, a, [contenteditable="true"]')) return;
      // Leave native scrollbar interaction alone.
      const bounds = element.getBoundingClientRect();
      if (event.clientY >= bounds.top + element.clientHeight || event.clientX >= bounds.left + element.clientWidth) return;
      gesture.current = { pointer: event.pointerId, x: event.clientX, scroll: element.scrollLeft, dragging: false };
      event.stopPropagation();
    }}
    onPointerMove={event => {
      const current = gesture.current;
      if (!current || event.pointerId !== current.pointer) return;
      const element = event.currentTarget;
      if (!(event.buttons & 1)) { finish(element, event.pointerId); return; }
      const delta = event.clientX - current.x;
      if (!current.dragging && Math.abs(delta) < 5) return;
      if (!current.dragging) {
        current.dragging = true;
        suppressClick.current = true;
        element.dataset.dragging = 'true';
        element.setPointerCapture(event.pointerId);
        window.getSelection()?.removeAllRanges();
      }
      event.preventDefault();
      element.scrollLeft = current.scroll - delta;
    }}
    onPointerUp={event => { if (gesture.current?.pointer === event.pointerId) finish(event.currentTarget, event.pointerId); }}
    onPointerCancel={event => { if (gesture.current?.pointer === event.pointerId) finish(event.currentTarget, event.pointerId); }}
    onLostPointerCapture={event => { if (gesture.current?.pointer === event.pointerId) finish(event.currentTarget, event.pointerId); }}
    onDragStart={event => { if (gesture.current) event.preventDefault(); }}
    onClickCapture={event => {
      if (suppressClick.current && event.detail > 0) {
        event.preventDefault(); event.stopPropagation(); suppressClick.current = false;
      }
    }}
  >{children}</div>;
}
