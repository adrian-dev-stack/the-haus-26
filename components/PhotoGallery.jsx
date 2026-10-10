"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export default function PhotoGallery({ photos }) {
  const [selected, setSelected] = useState(null);
  const dialogRef = useRef(null);
  const openerRef = useRef(null);
  const thumbStripRef = useRef(null);
  const touchStartRef = useRef(null);

  const isOpen = selected !== null;
  const activePhoto = isOpen ? photos[selected] : null;

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  // Keep thumbnail strip scrolled to selected photo
  useEffect(() => {
    if (selected !== null && thumbStripRef.current) {
      const activeThumb = thumbStripRef.current.children[selected];
      if (activeThumb) {
        activeThumb.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
    }
  }, [selected]);

  function openPhoto(index, event) {
    if (event?.currentTarget) {
      openerRef.current = event.currentTarget;
    }
    setSelected(index);
    if (dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal();
    }
  }

  function closeDialog() {
    if (dialogRef.current?.open) {
      dialogRef.current.close();
    }
    setSelected(null);
    openerRef.current?.focus();
  }

  function stepPhoto(direction) {
    setSelected((current) => (current + direction + photos.length) % photos.length);
  }

  // Touch swipe support for mobile lightbox
  function handleTouchStart(e) {
    touchStartRef.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e) {
    if (touchStartRef.current === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStartRef.current - touchEnd;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        stepPhoto(1); // Swiped left -> next
      } else {
        stepPhoto(-1); // Swiped right -> prev
      }
    }
    touchStartRef.current = null;
  }

  if (!photos || photos.length === 0) return null;

  const heroPhoto = photos[0];
  const sidePhotos = photos.slice(1, 5);

  return (
    <section id="gallery" className="scroll-mt-24" aria-label="Photos of the house">
      {/* Gallery Section Header */}
      <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
            The Property
          </span>
          <h2 className="mt-1 font-display text-2xl font-normal tracking-tight text-ink sm:text-3xl">
            Photo Gallery
          </h2>
        </div>
        <p className="text-xs text-muted sm:text-sm">
          Select any view to explore all {photos.length} photos in full detail
        </p>
      </div>

      {/* LUXE BENTO GRID CONTAINER */}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-surface/60 shadow-xs sm:rounded-3xl">
        {/* DESKTOP BENTO GRID (md and above): 4 cols x 2 rows */}
        <div className="hidden h-[480px] w-full grid-cols-4 grid-rows-2 gap-2 p-2 md:grid lg:h-[560px] lg:gap-2.5 lg:p-2.5">
          {/* Hero Tile (Left 50% - spans 2 columns & 2 rows) */}
          <button
            type="button"
            className="gallery-bento-item group relative col-span-2 row-span-2 h-full w-full overflow-hidden rounded-xl bg-surface text-left focus-visible:outline-2 focus-visible:outline-accent"
            onClick={(e) => openPhoto(0, e)}
            aria-label={`View full photo: ${heroPhoto.title || heroPhoto.alt}`}
            aria-haspopup="dialog"
          >
            <Image
              src={heroPhoto.src}
              alt={heroPhoto.alt}
              fill
              priority
              sizes="(max-width: 1024px) 50vw, 640px"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              style={{ objectPosition: heroPhoto.position || "center" }}
            />
            {/* Subtle Gradient & Hover Vignette */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent opacity-85 transition-opacity duration-300 group-hover:opacity-95" />

            {/* Hero Caption Chip */}
            <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
              <div>
                <span className="inline-block rounded-full bg-accent/30 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-accent-glow backdrop-blur-md border border-accent/30">
                  FEATURED VIEW
                </span>
                <p className="mt-1 text-sm font-semibold text-white drop-shadow-xs sm:text-base">
                  {heroPhoto.title}
                </p>
              </div>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition-transform duration-300 group-hover:scale-110">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
              </span>
            </div>
          </button>

          {/* 4 Quadrant Bento Tiles on the Right */}
          {sidePhotos.map((photo, index) => {
            const photoIndex = index + 1;
            return (
              <button
                key={photo.src}
                type="button"
                className="gallery-bento-item group relative col-span-1 row-span-1 h-full w-full overflow-hidden rounded-xl bg-surface text-left focus-visible:outline-2 focus-visible:outline-accent"
                onClick={(e) => openPhoto(photoIndex, e)}
                aria-label={`View full photo: ${photo.title || photo.alt}`}
                aria-haspopup="dialog"
              >
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  sizes="(max-width: 1024px) 25vw, 320px"
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  style={{ objectPosition: photo.position || "center" }}
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="absolute bottom-2 left-2 right-2 rounded-md bg-black/60 px-2 py-1 backdrop-blur-xs opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <p className="truncate text-[11px] font-medium text-white">{photo.title}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* MOBILE BENTO LAYOUT (Screen < md) */}
        <div className="p-2 md:hidden">
          {/* Main Hero Card */}
          <button
            type="button"
            className="gallery-bento-item group relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-surface text-left focus-visible:outline-2 focus-visible:outline-accent"
            onClick={(e) => openPhoto(0, e)}
            aria-label={`View full photo: ${heroPhoto.title || heroPhoto.alt}`}
            aria-haspopup="dialog"
          >
            <Image
              src={heroPhoto.src}
              alt={heroPhoto.alt}
              fill
              priority
              sizes="100vw"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              style={{ objectPosition: heroPhoto.position || "center" }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-90" />
            <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
              <div>
                <span className="inline-block rounded-full bg-accent/30 px-2 py-0.5 text-[9px] font-semibold tracking-wider text-accent-glow backdrop-blur-md border border-accent/30">
                  FEATURED
                </span>
                <p className="mt-0.5 text-xs font-semibold text-white">{heroPhoto.title}</p>
              </div>
            </div>
          </button>

          {/* 2x2 Grid of Secondary Photos */}
          <div className="mt-2 grid grid-cols-2 gap-2">
            {sidePhotos.map((photo, index) => {
              const photoIndex = index + 1;
              return (
                <button
                  key={photo.src}
                  type="button"
                  className="gallery-bento-item group relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-surface text-left focus-visible:outline-2 focus-visible:outline-accent"
                  onClick={(e) => openPhoto(photoIndex, e)}
                  aria-label={`View full photo: ${photo.title || photo.alt}`}
                  aria-haspopup="dialog"
                >
                  <Image
                    src={photo.src}
                    alt={photo.alt}
                    fill
                    sizes="50vw"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    style={{ objectPosition: photo.position || "center" }}
                  />
                  <div className="absolute inset-0 bg-black/25" />
                  <div className="absolute bottom-1.5 left-1.5 right-1.5">
                    <p className="truncate text-[10px] font-medium text-white drop-shadow-xs">{photo.title}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* FLOATING LUXE BADGE BUTTON: "View all 6 photos" */}
        <button
          type="button"
          onClick={(e) => openPhoto(0, e)}
          className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-2 rounded-full border border-line bg-surface-elevated/90 px-3.5 py-2 text-xs font-semibold text-ink shadow-lg backdrop-blur-md transition-all hover:bg-surface-elevated hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-accent sm:bottom-4 sm:right-4 sm:px-4 sm:py-2.5"
          aria-label={`Open photo viewer with all ${photos.length} photos`}
          aria-haspopup="dialog"
        >
          {/* 4-Square Bento Icon */}
          <svg className="h-3.5 w-3.5 text-accent-glow" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <rect x="1" y="1" width="6" height="6" rx="1.5" />
            <rect x="9" y="1" width="6" height="6" rx="1.5" />
            <rect x="1" y="9" width="6" height="6" rx="1.5" />
            <rect x="9" y="9" width="6" height="6" rx="1.5" />
          </svg>
          <span>View all {photos.length} photos</span>
        </button>
      </div>

      {/* FULLSCREEN LIGHTBOX DIALOG */}
      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-auto h-[92vh] max-h-[820px] w-[95vw] max-w-5xl rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-stone-950/85 backdrop:backdrop-blur-md"
        aria-labelledby="photo-dialog-title"
        onClose={closeDialog}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDialog();
        }}
        onKeyDown={(event) => {
          if (event.key === "Tab") {
            const controls = dialogRef.current?.querySelectorAll("button");
            if (!controls || controls.length === 0) return;
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            stepPhoto(-1);
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            stepPhoto(1);
          }
        }}
      >
        <div className="flex h-full flex-col p-4 sm:p-6">
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div>
              <span className="text-xs font-semibold text-muted">
                Photo {selected !== null ? selected + 1 : 1} of {photos.length}
              </span>
              <h2 id="photo-dialog-title" className="font-display text-lg text-ink sm:text-xl">
                {activePhoto?.title || "Property View"}
              </h2>
            </div>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface-elevated text-ink transition-colors hover:bg-surface-hover active:scale-95"
              onClick={closeDialog}
              aria-label="Close photo viewer"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Active Image Display Stage */}
          <div
            className="relative flex flex-1 items-center justify-center overflow-hidden py-3"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {activePhoto && (
              <div className="relative h-full w-full">
                <Image
                  src={activePhoto.src}
                  alt={activePhoto.alt}
                  fill
                  sizes="(max-width: 1024px) 95vw, 1024px"
                  className="object-contain"
                  priority
                />
              </div>
            )}

            {/* Previous / Next Stage Floating Controls */}
            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full border border-line bg-surface-elevated/90 p-2.5 text-ink shadow-md backdrop-blur-xs transition-transform hover:scale-110 hover:bg-surface-elevated active:scale-95 sm:left-4"
                  onClick={() => stepPhoto(-1)}
                  aria-label="Previous photo"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-line bg-surface-elevated/90 p-2.5 text-ink shadow-md backdrop-blur-xs transition-transform hover:scale-110 hover:bg-surface-elevated active:scale-95 sm:right-4"
                  onClick={() => stepPhoto(1)}
                  aria-label="Next photo"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
          </div>

          {/* Modal Footer & Thumbnails Carousel */}
          <div className="border-t border-line pt-3">
            <p className="mb-2 text-center text-xs text-muted sm:text-left">
              {activePhoto?.alt}
            </p>
            {/* Thumbnail selector row */}
            <div
              ref={thumbStripRef}
              className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 hide-scrollbar"
            >
              {photos.map((photo, idx) => (
                <button
                  key={photo.src}
                  type="button"
                  onClick={() => setSelected(idx)}
                  className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                    selected === idx
                      ? "border-accent-glow ring-2 ring-accent/30 scale-105"
                      : "border-transparent opacity-50 hover:opacity-100"
                  }`}
                  aria-label={`Jump to photo ${idx + 1}: ${photo.title || photo.alt}`}
                >
                  <Image
                    src={photo.src}
                    alt={photo.alt}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </dialog>
    </section>
  );
}
