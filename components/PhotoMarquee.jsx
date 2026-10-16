"use client";

import { useState } from "react";
import Image from "next/image";
import "./PhotoMarquee.css";

function MarqueeImage({ photo }) {
  return (
    <Image
      src={photo.src}
      alt={photo.alt || photo.title || "Haus 26 property photo"}
      fill
      sizes="(max-width: 640px) 280px, 400px"
      className="object-cover transition-transform duration-500 hover:scale-105"
      style={{ objectPosition: photo.position || "center" }}
    />
  );
}

export default function PhotoMarquee({ photos = [], onPhotoClick, className = "" }) {
  const [isPaused, setIsPaused] = useState(false);
  if (!photos.length) return null;

  const row1Photos = photos.map((photo, i) => ({
    photo,
    originalIndex: i,
    isWide: i % 3 === 0,
  }));

  const row2Photos = [...photos.slice(3), ...photos.slice(0, 3)].map((photo, i) => ({
    photo,
    originalIndex: photos.indexOf(photo),
    isWide: (i + 1) % 3 === 0,
  }));

  // Duplicate for seamless 50% visual loop
  const row1Items = [...row1Photos, ...row1Photos];
  const row2Items = [...row2Photos, ...row2Photos];

  return (
    <div className={`photo-marquee-container ${isPaused ? "is-paused" : ""} ${className}`.trim()}>
      <div className="photo-marquee-controls">
        <button
          type="button"
          onClick={() => setIsPaused(!isPaused)}
          className="photo-marquee-toggle-btn"
          aria-label={isPaused ? "Play gallery animation" : "Pause gallery animation"}
          aria-pressed={isPaused}
        >
          {isPaused ? "▶ Resume gallery motion" : "⏸ Pause gallery motion"}
        </button>
      </div>
      <div className="photo-marquee-rows">
        {/* Row 1 - Forward */}
        <div className="photo-marquee-row">
          <div className="photo-marquee-track">
            {row1Items.map((item, idx) => {
              const isDuplicate = idx >= photos.length;
              return (
                <button
                  key={`r1-${item.originalIndex}-${idx}`}
                  type="button"
                  tabIndex={isDuplicate ? -1 : 0}
                  aria-hidden={isDuplicate ? "true" : undefined}
                  onClick={(event) => onPhotoClick?.(item.originalIndex, event)}
                  className={`photo-marquee-card ${item.isWide ? "is-wide" : ""}`}
                  aria-label={isDuplicate ? undefined : `View photo ${item.originalIndex + 1} of ${photos.length}: ${item.photo.title || item.photo.alt || "Haus 26"}`}
                  aria-haspopup="dialog"
                >
                  <MarqueeImage photo={item.photo} />
                  <span className="photo-card-info" aria-hidden="true">
                    <span>{item.photo.title || item.photo.alt}</span>
                    <span className="photo-card-expand">Expand ↗</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 2 - Reverse */}
        <div className="photo-marquee-row">
          <div className="photo-marquee-track is-reverse">
            {row2Items.map((item, idx) => (
              <button
                key={`r2-${item.originalIndex}-${idx}`}
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                onClick={(event) => onPhotoClick?.(item.originalIndex, event)}
                className={`photo-marquee-card ${item.isWide ? "is-wide" : ""}`}
                aria-haspopup="dialog"
              >
                <MarqueeImage photo={item.photo} />
                <span className="photo-card-info" aria-hidden="true">
                  <span>{item.photo.title || item.photo.alt}</span>
                  <span className="photo-card-expand">Expand ↗</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
