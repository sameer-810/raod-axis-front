import { useId } from "react";
import type { SeriesPoint } from "../types";

/**
 * A daily trend, drawn as inline SVG.
 *
 * No chart library: this is thirty numbers and a line, and the smallest capable
 * package is ~40 kB gzipped. A library chart also arrives as a `<canvas>` or a
 * pile of unlabelled `<path>`s — this one has a real table behind it, so the
 * data is readable by a screen reader and by anyone who wants the figures.
 *
 * The zero-height case is explicit: a flat series would divide by zero and draw
 * nothing, which reads as a broken chart rather than a quiet month.
 */
export function Sparkline({
  points,
  label,
  className,
}: {
  points: SeriesPoint[];
  label: string;
  className?: string;
}) {
  const id = useId();
  const width = 300;
  const height = 56;

  if (!points.length) return null;

  const max = Math.max(...points.map((p) => p.count), 1);
  const step = points.length > 1 ? width / (points.length - 1) : width;

  const coords = points.map((p, i) => {
    const x = i * step;
    // 2px of padding top and bottom, so a maximum point is not clipped by the
    // viewBox and a zero is not flush against the baseline.
    const y = height - 2 - (p.count / max) * (height - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const total = points.reduce((sum, p) => sum + p.count, 0);

  return (
    <figure className={className}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-14 w-full"
        role="img"
        aria-labelledby={id}
      >
        <title id={id}>
          {label}: {total} over {points.length} days, peaking at {max} in a day
        </title>
        {/* Fill first, so the stroke sits on top of its own shading. */}
        <polygon
          points={`0,${height} ${coords.join(" ")} ${width},${height}`}
          className="fill-primary/10"
        />
        <polyline
          points={coords.join(" ")}
          fill="none"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          className="stroke-primary"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <figcaption className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>{points[0].date}</span>
        <span className="font-mono tabular-nums">{total} total</span>
        <span>{points[points.length - 1].date}</span>
      </figcaption>
    </figure>
  );
}
