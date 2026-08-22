"use client";

import { useEffect } from "react";

export function GuardiaoCardRuntime() {
  useEffect(() => {
    const apply = () => {
      const cards = Array.from(document.querySelectorAll<HTMLElement>(".doc-card"));
      cards.forEach((card) => {
        const directImage = card.querySelector<HTMLImageElement>(":scope > img:not(.guardiao-runtime-img)");
        if (directImage) directImage.style.display = "none";

        if (!card.querySelector(":scope > .guardiao-runtime-img")) {
          const img = document.createElement("img");
          img.src = "/assets/guardiao-monitor.webp";
          img.alt = "Guardião DOCTYPE";
          img.className = "guardiao-runtime-img";
          img.decoding = "async";
          card.appendChild(img);
        }
      });
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
