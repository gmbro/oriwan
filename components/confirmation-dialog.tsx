"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import styles from "./confirmation-dialog.module.css";

// showModal puts the confirmation in the browser's top layer, including when
// opened inside another modal or a content-visibility/overflow container.
export function ConfirmationDialog({ title, description, children, confirmLabel = "삭제하기", busy = false, disabled = false, destructive = true, onCancel, onConfirm }: {
  title: string; description: string; children?: ReactNode; confirmLabel?: string;
  busy?: boolean; disabled?: boolean; destructive?: boolean;
  onCancel: () => void; onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    cancelRef.current?.focus();
    return () => dialog.close();
  }, []);
  return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); if (!busy) onCancel(); }}
    onClick={event => {
      event.stopPropagation();
      if (busy || event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onCancel();
    }}>
    <h2 id={titleId}>{title}</h2>
    <p id={descriptionId}>{description}</p>
    {children}
    <div className={styles.actions}>
      <button ref={cancelRef} type="button" autoFocus disabled={busy} onClick={onCancel}>취소</button>
      <button type="button" className={destructive ? styles.destructive : styles.primary} disabled={busy || disabled} onClick={onConfirm}>{busy ? "처리 중…" : confirmLabel}</button>
    </div>
  </dialog>;
}
