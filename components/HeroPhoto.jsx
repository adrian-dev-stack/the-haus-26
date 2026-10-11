"use client";
import Image from "next/image";
import { useState } from "react";

export default function HeroPhoto({ photo }) {
  const [status, setStatus] = useState("loading");
  if (!photo) return <div className="hero-photo-empty"><p>House photos are being prepared.</p><a href="#inquire" className="text-link">Ask the host about the property</a></div>;
  return (
    <figure className="hero-photo">
      <a href="#gallery" className="hero-photo-frame" aria-label="See the house photo gallery">
        {status !== "error" && <Image src={photo.src} alt={photo.alt} fill priority sizes="(min-width: 960px) 48vw, (min-width: 640px) 60vw, 100vw" className="hero-image" style={{ objectPosition: photo.position || "center" }} onLoad={() => setStatus("ready")} onError={() => setStatus("error")} />}
        {status !== "ready" && <span className="hero-photo-status" role="status">{status === "error" ? "This photo could not load. See the gallery for more views." : "Loading the pool view…"}</span>}
      </a>
      <figcaption><span>{photo.title}</span><span>Exclusively yours for 22 hours</span></figcaption>
    </figure>
  );
}
