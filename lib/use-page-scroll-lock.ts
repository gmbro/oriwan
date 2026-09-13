"use client";

import { useLayoutEffect } from "react";

let locks = 0;
let restore: (() => void) | undefined;

/** Shared ownership keeps nested dialogs from unlocking the page prematurely. */
export function lockPageScroll() {
  if (locks++ === 0) {
    const body = document.body;
    const root = document.documentElement;
    const x = window.scrollX;
    const y = window.scrollY;
    const properties = ["position", "top", "left", "width", "overflow", "padding-right"];
    const previous = properties.map(key => [key, body.style.getPropertyValue(key), body.style.getPropertyPriority(key)]);
    const overflow = root.style.overflow;
    const behavior = root.style.scrollBehavior;
    const gutter = window.innerWidth - root.clientWidth;
    const padding = getComputedStyle(body).paddingRight;
    root.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `${-y}px`;
    body.style.left = `${-x}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    if (gutter > 0) body.style.paddingRight = `calc(${padding} + ${gutter}px)`;
    restore = () => {
      for (const [key, value, priority] of previous) {
        if (value) body.style.setProperty(key, value, priority);
        else body.style.removeProperty(key);
      }
      root.style.overflow = overflow;
      root.style.scrollBehavior = "auto";
      window.scrollTo(x, y);
      root.style.scrollBehavior = behavior;
    };
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--locks === 0) { restore?.(); restore = undefined; }
  };
}

export function usePageScrollLock(active: boolean) {
  useLayoutEffect(() => {
    if (active) return lockPageScroll();
  }, [active]);
}
