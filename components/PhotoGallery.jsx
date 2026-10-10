"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

function Photo({ photo, sizes, priority = false, full = false }) {
  const [status, setStatus] = useState("loading");

  return (
    <span className={`photo-image ${full ? "photo-image-full" : ""}`}>
      {status !== "loaded" && (
        <span className="photo-status" role={status === "error" ? "status" : undefined}>
          {status === "error"
            ? "This photo couldn't load. Please try again later."
            : "Loading photo…"}
        </span>
      )}
      {status !== "error" && (
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          sizes={sizes}
          priority={priority}
          style={{ objectPosition: full ? "center" : photo.position || "center" }}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
        />
      )}
    </span>
  );
}

export default function PhotoGallery({ photos }) {
  const [selected, setSelected] = useState(null);
  const dialogRef = useRef(null);
  const openerRef = useRef(null);
  const isOpen = selected !== null;
  const activePhoto = isOpen ? photos[selected] : null;

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isOpen]);

  function openPhoto(index, event) {
    openerRef.current = event.currentTarget;
    setSelected(index);
    dialogRef.current.showModal();
  }

  function stepPhoto(direction) {
    setSelected((current) => (current + direction + photos.length) % photos.length);
  }

  function photoButton(photo, index, featured) {
    return (
      <button
        key={photo.src}
        type="button"
        className="photo-button"
        aria-label={`View ${photo.title || photo.alt} photo`}
        aria-haspopup="dialog"
        onClick={(event) => openPhoto(index, event)}
      >
        <span className="photo-frame">
          <Photo
            photo={photo}
            priority={featured}
            sizes={featured
              ? "(max-width: 639px) 100vw, (max-width: 1199px) 60vw, 760px"
              : "(max-width: 639px) 50vw, (max-width: 959px) 50vw, 300px"}
          />
          <span className="photo-open" aria-hidden="true">View photo</span>
        </span>
        <span className="photo-caption">
          <span>{photo.title || photo.alt}</span>
          <span className="photo-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
        </span>
      </button>
    );
  }

  if (!photos.length) return null;

  return (
    <section id="gallery" className="photo-gallery scroll-mt-24" aria-label="Photos of the house">
      <div className={`photo-featured ${photos.length === 1 ? "photo-featured-single" : ""}`}>
        {photos.slice(0, 2).map((photo, index) => photoButton(photo, index, true))}
      </div>

      {photos.length > 2 && (
        <div className="photo-more">
          <div className="gallery-heading">
            <h2>Around the house</h2>
            <p>Select a photo for a closer look.</p>
          </div>
          <div className="photo-details">
            {photos.slice(2).map((photo, index) => photoButton(photo, index + 2, false))}
          </div>
        </div>
      )}

      <dialog
        ref={dialogRef}
        className="photo-dialog"
        aria-labelledby="photo-dialog-title"
        onClose={() => {
          setSelected(null);
          openerRef.current?.focus();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialogRef.current.close();
        }}
        onKeyDown={(event) => {
          if (event.key === "Tab") {
            const controls = dialogRef.current.querySelectorAll("button");
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
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            stepPhoto(event.key === "ArrowLeft" ? -1 : 1);
          }
        }}
      >
        <div className="photo-dialog-content">
          <div className="photo-dialog-header">
            <h2 id="photo-dialog-title">A closer look</h2>
            <button type="button" className="viewer-control" onClick={() => dialogRef.current.close()}>Close</button>
          </div>
          {activePhoto && (
            <>
              <div className="photo-dialog-frame">
                <Photo key={activePhoto.src} photo={activePhoto} sizes="(max-width: 767px) 100vw, 1100px" full />
              </div>
              <div className="photo-dialog-footer">
                <p aria-live="polite" aria-atomic="true">
                  <span className="viewer-count">{selected + 1} / {photos.length}</span>
                  {activePhoto.title || activePhoto.alt}
                </p>
                {photos.length > 1 && (
                  <div className="viewer-navigation">
                    <button type="button" className="viewer-control" onClick={() => stepPhoto(-1)}>Previous</button>
                    <button type="button" className="viewer-control" onClick={() => stepPhoto(1)}>Next</button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </dialog>
    </section>
  );
}
