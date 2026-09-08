import { useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface Photo {
  id: string;
  url: string;
  thumbnailUrl: string | null;
}

/**
 * The business's own photographs.
 *
 * These are the content, not decoration: a picture of a real workshop is the
 * fastest trust signal available, which is why the product asks for five to ten
 * of them and why no stock photography is allowed near them — a stock image
 * beside a real one makes the real one look fake.
 *
 * A scrolling strip rather than a carousel with dots. A strip shows there is
 * more by being cut off at the edge, needs no controls, and is dragged with the
 * thumb already on the screen.
 */
export function PhotoGallery({ photos, businessName }: { photos: Photo[]; businessName: string }) {
  const [lightbox, setLightbox] = useState<number | null>(null);

  if (photos.length === 0) return null;

  const close = () => setLightbox(null);
  const step = (delta: number) =>
    setLightbox((i) => (i === null ? null : (i + delta + photos.length) % photos.length));

  return (
    <>
      <div className="ra-chips" role="list">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            role="listitem"
            onClick={() => setLightbox(i)}
            className="h-40 w-56 shrink-0 overflow-hidden rounded-lg border border-border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-48 sm:w-64"
          >
            <img
              src={photo.thumbnailUrl ?? photo.url}
              // Named rather than "image": a screen-reader user learns whose
              // premises they are looking at and where in the set they are.
              alt={`${businessName}, photo ${i + 1} of ${photos.length}`}
              loading={i < 2 ? "eager" : "lazy"}
              className="h-full w-full object-cover"
            />
          </button>
        ))}
      </div>

      {lightbox !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${businessName} photos`}
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
            if (e.key === "ArrowRight") step(1);
            if (e.key === "ArrowLeft") step(-1);
          }}
          tabIndex={-1}
          ref={(el) => el?.focus()}
        >
          <button
            type="button"
            onClick={close}
            aria-label="Close photos"
            className="ra-tap absolute end-3 top-3 flex items-center justify-center rounded-lg text-white/80 transition-colors hover:text-white"
          >
            <X className="h-6 w-6" aria-hidden="true" />
          </button>

          <img
            src={photos[lightbox].url}
            alt={`${businessName}, photo ${lightbox + 1} of ${photos.length}`}
            className="max-h-full max-w-full rounded-lg object-contain"
          />

          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="Previous photo"
                className="ra-tap absolute start-3 flex items-center justify-center rounded-full bg-black/50 text-white"
              >
                <ChevronLeft className="h-6 w-6" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label="Next photo"
                className="ra-tap absolute end-3 flex items-center justify-center rounded-full bg-black/50 text-white"
              >
                <ChevronRight className="h-6 w-6" aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
