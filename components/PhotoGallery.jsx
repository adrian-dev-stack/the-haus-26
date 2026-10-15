"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import PhotoMarquee from "./PhotoMarquee";

function GalleryImage({ photo, fullSize = false }) {
  const [status, setStatus] = useState("loading");

  return (
    <>
      {status !== "loaded" && (
        <span
          className="absolute inset-0 flex items-center justify-center bg-surface px-4 text-center text-sm text-muted"
          role={fullSize ? "status" : undefined}
        >
          {status === "error"
            ? "This photo could not load. Try reloading the page."
            : "Loading photo..."}
        </span>
      )}
      {status !== "error" && (
        <Image
          src={photo.src}
          alt={photo.alt || photo.title || "Haus 26 property photo"}
          fill
          sizes={fullSize ? "(max-width: 1024px) 94vw, 1100px" : "(max-width: 767px) 45vw, (max-width: 1280px) 30vw, 410px"}
          className={`${fullSize ? "object-contain" : "object-cover transition-transform duration-500 group-hover:scale-105"} ${status === "loaded" ? "opacity-100" : "opacity-0"}`}
          style={fullSize ? undefined : { objectPosition: photo.position || "center" }}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
        />
      )}
    </>
  );
}

function DirectionIcon({ next = false }) {
  return (
    <svg aria-hidden="true" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d={next ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"} />
    </svg>
  );
}

export default function PhotoGallery({ photos = [] }) {
  const galleryPhotos = Array.isArray(photos) ? photos.filter((photo) => photo?.src) : [];
  const [selected, setSelected] = useState(null);
  const dialogRef = useRef(null);
  const openerRef = useRef(null);
  const closeButtonRef = useRef(null);
  const touchStartRef = useRef(null);
  const photoCount = galleryPhotos.length;
  const isOpen = selected !== null && photoCount > 0;
  const activeIndex = isOpen ? Math.min(selected, photoCount - 1) : null;
  const activePhoto = activeIndex !== null ? galleryPhotos[activeIndex] : null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen || !dialog) {
      if (dialog?.open) dialog.close();
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!dialog.open) {
      dialog.showModal();
      closeButtonRef.current?.focus();
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  function openPhoto(index, event) {
    openerRef.current = event.currentTarget;
    setSelected(index);
  }

  function closeDialog() {
    if (dialogRef.current?.open) dialogRef.current.close();
    setSelected(null);
    openerRef.current?.focus();
  }

  function stepPhoto(direction) {
    if (photoCount < 2) return;
    setSelected((current) => {
      if (current === null) return null;
      return (Math.min(current, photoCount - 1) + direction + photoCount) % photoCount;
    });
  }

  function handleKeyDown(event) {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      stepPhoto(event.key === "ArrowRight" ? 1 : -1);
    }
    if (event.key === "Tab") {
      const controls = dialogRef.current?.querySelectorAll("button:not(:disabled)");
      if (!controls?.length) return;
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
  }

  return (
    <section id="gallery" className="scroll-mt-24" aria-labelledby="gallery-title">
      <div className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="section-label">Villa Tour</p>
          <h2 id="gallery-title" className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Around The HauS 26
          </h2>
        </div>
        {photoCount > 0 && (
          <p className="max-w-xs text-sm leading-relaxed text-muted">
            {photoCount === 1 ? "Click the photo for a full high-resolution view." : `${photoCount} curated views of the villa. Click any photo to expand.`}
          </p>
        )}
      </div>

      {photoCount === 0 ? (
        <p className="rounded-2xl border border-divider bg-surface p-8 text-base text-muted shadow-sm">
          House photos are not available here yet. Please contact Haus 26 to ask for recent photos.
        </p>
      ) : (
        <PhotoMarquee
          photos={galleryPhotos}
          onPhotoClick={(index, event) => openPhoto(index, event)}
        />
      )}

      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-auto h-[92dvh] max-h-[960px] w-[94vw] max-w-6xl overflow-y-auto rounded-2xl border border-divider bg-paper p-0 text-ink shadow-2xl backdrop:bg-ink/75"
        aria-labelledby="photo-dialog-title"
        onClose={closeDialog}
        onCancel={(event) => {
          event.preventDefault();
          closeDialog();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDialog();
        }}
        onKeyDown={handleKeyDown}
      >
        <div className="flex h-full min-h-[340px] flex-col px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-divider pb-3">
            <div className="min-w-0" aria-live="polite" aria-atomic="true">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent">Photo {activeIndex !== null ? activeIndex + 1 : 1} of {photoCount}</p>
              <h2 id="photo-dialog-title" className="mt-1 font-display text-lg font-semibold text-ink sm:text-xl">
                {activePhoto?.title || "Haus 26 photo"}
              </h2>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeDialog}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-divider bg-surface px-4 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-surface-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              aria-label="Close photo viewer"
            >
              <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Close
            </button>
          </div>

          <div
            className="relative my-4 min-h-[120px] flex-1"
            onTouchStart={(event) => {
              touchStartRef.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
            }}
            onTouchCancel={() => { touchStartRef.current = null; }}
            onTouchEnd={(event) => {
              const start = touchStartRef.current;
              touchStartRef.current = null;
              if (!start) return;
              const changeX = start.x - event.changedTouches[0].clientX;
              const changeY = start.y - event.changedTouches[0].clientY;
              if (Math.abs(changeX) > 50 && Math.abs(changeX) > Math.abs(changeY)) {
                stepPhoto(changeX > 0 ? 1 : -1);
              }
            }}
          >
            {activePhoto && <GalleryImage key={`${activePhoto.src}-${activeIndex}`} photo={activePhoto} fullSize />}
          </div>

          <div className="shrink-0 border-t border-divider pt-3">
            <p className="text-sm leading-relaxed text-muted">{activePhoto?.alt}</p>
            {photoCount > 1 && (
              <div className="mt-3 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => stepPhoto(-1)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-divider bg-surface px-4 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-surface-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  aria-label="Previous photo"
                >
                  <DirectionIcon />
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => stepPhoto(1)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-divider bg-surface px-4 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-surface-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  aria-label="Next photo"
                >
                  Next
                  <DirectionIcon next />
                </button>
              </div>
            )}
          </div>
        </div>
      </dialog>
    </section>
  );
}
