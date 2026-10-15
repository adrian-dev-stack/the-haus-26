"use client";

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

  // Duplicate for seamless 50% loop
  const row1Items = [...row1Photos, ...row1Photos];
  const row2Items = [...row2Photos, ...row2Photos];

  return (
    <div className={`photo-marquee-container ${className}`.trim()}>
      <div className="photo-marquee-rows">
        {/* Row 1 - Forward */}
        <div className="photo-marquee-row">
          <div className="photo-marquee-track">
            {row1Items.map((item, idx) => (
              <button
                key={`r1-${item.originalIndex}-${idx}`}
                type="button"
                onClick={(event) => onPhotoClick?.(item.originalIndex, event)}
                className={`photo-marquee-card ${item.isWide ? "is-wide" : ""}`}
                aria-label={`View photo: ${item.photo.title || item.photo.alt || "Haus 26"}`}
                aria-haspopup="dialog"
              >
                <MarqueeImage photo={item.photo} />
                <span className="photo-card-info">
                  <span>{item.photo.title || item.photo.alt}</span>
                  <span className="photo-card-expand">Expand ↗</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Row 2 - Reverse */}
        <div className="photo-marquee-row">
          <div className="photo-marquee-track is-reverse">
            {row2Items.map((item, idx) => (
              <button
                key={`r2-${item.originalIndex}-${idx}`}
                type="button"
                onClick={(event) => onPhotoClick?.(item.originalIndex, event)}
                className={`photo-marquee-card ${item.isWide ? "is-wide" : ""}`}
                aria-label={`View photo: ${item.photo.title || item.photo.alt || "Haus 26"}`}
                aria-haspopup="dialog"
              >
                <MarqueeImage photo={item.photo} />
                <span className="photo-card-info">
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
