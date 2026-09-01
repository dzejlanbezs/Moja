"use client";

import Image from "next/image";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";

export function Gallery({ photos, name }: { photos: string[]; name: string }) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);

  const go = (delta: number) => setIndex((current) => (current + delta + photos.length) % photos.length);

  return (
    <div>
      <div className="group relative aspect-4/5 overflow-hidden rounded-[30px] border border-white/10 sm:aspect-3/4">
        {photos.map((photo, photoIndex) => (
          <Image
            key={photo}
            src={photo}
            alt={`${name} — photo ${photoIndex + 1}`}
            fill
            priority={photoIndex === 0}
            sizes="(max-width: 1024px) 100vw, 46vw"
            className={`object-cover transition-opacity duration-500 ${
              photoIndex === index ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950/55 via-transparent to-transparent" />

        <button
          onClick={() => setZoom(true)}
          className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-ink-950/55 text-white opacity-0 backdrop-blur-md transition group-hover:opacity-100"
          aria-label="Expand photo"
        >
          <Expand className="h-4 w-4" />
        </button>

        {photos.length > 1 && (
          <>
            <button
              onClick={() => go(-1)}
              className="absolute top-1/2 left-4 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-ink-950/55 text-white backdrop-blur-md transition hover:bg-ink-950/80"
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => go(1)}
              className="absolute top-1/2 right-4 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-ink-950/55 text-white backdrop-blur-md transition hover:bg-ink-950/80"
              aria-label="Next photo"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
              {photos.map((photo, photoIndex) => (
                <span
                  key={photo}
                  className={`h-1.5 rounded-full transition-all ${
                    photoIndex === index ? "w-6 bg-white" : "w-1.5 bg-white/40"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {photos.length > 1 && (
        <div className="mt-3 grid grid-cols-4 gap-3">
          {photos.map((photo, photoIndex) => (
            <button
              key={photo}
              onClick={() => setIndex(photoIndex)}
              className={`relative aspect-square overflow-hidden rounded-2xl border transition ${
                photoIndex === index
                  ? "border-blush-500/70 ring-2 ring-blush-500/25"
                  : "border-white/8 opacity-70 hover:opacity-100"
              }`}
            >
              <Image src={photo} alt="" fill sizes="120px" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      {zoom && (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center bg-ink-950/90 p-6 backdrop-blur-xl"
          onClick={() => setZoom(false)}
        >
          <button className="absolute top-6 right-6 btn-ghost h-11 w-11 !px-0" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
          <div className="relative h-full max-h-[85vh] w-full max-w-3xl animate-pop">
            <Image src={photos[index]} alt={name} fill sizes="90vw" className="object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
