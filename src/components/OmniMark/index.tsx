import React from 'react';
import styles from './styles.module.css';

interface OmniMarkProps {
  size?: number;
  className?: string;
}

/**
 * Omnitron hero mark — a cyberpunk-styled reconstruction of the original
 * holon spinner.
 *
 * The mark is four polygons: a green core surrounded by three violet
 * triangles. The original implementation used svg.js to imperatively
 * "explode" each triangle outward from the core, then snap them back, then
 * rotate the whole figure. This component does the same thing with a static
 * inline SVG and pure CSS keyframes — no JS animation loop needed.
 *
 * Layered behind the mark:
 *   1. Outer atmospheric cloud (cyan / violet, slow breathe)
 *   2. Mid chromatic aberration halo (magenta / cyan slide)
 *   3. Warm core glow (emerald / amber pulse)
 *
 * The polygon coordinates are taken verbatim from the holon source, then
 * placed inside a 300×300 viewBox with the same skew matrix the original
 * applied. The matrix is folded into a `<g transform>` so we don't have to
 * recompute coordinates.
 */
export default function OmniMark({size = 460, className}: OmniMarkProps) {
  return (
    <div
      className={[styles.mark, className].filter(Boolean).join(' ')}
      style={{maxWidth: size}}
      aria-hidden={false}
    >
      <div className={styles.haloOuter} />
      <div className={styles.haloMid} />
      <div className={styles.haloCore} />
      <div className={styles.scanlines} />

      <svg
        viewBox="-100 -100 500 500"
        className={styles.svg}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Omnitron logo"
      >
        <defs>
          <filter id="omni-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* This group reproduces the holon source's affine transform exactly:
            matrix(1.0218979, -0.29499649, 0.29499649, 1.0218979, -46.5122, 80.4943).
            That tilts the figure ~16° clockwise and shifts it back so the
            rotated mark stays centred. The expanded viewBox gives the spin
            and shell-extrude motions room to play without clipping. */}
        <g
          className={styles.figure}
          transform="matrix(1.0218979,-0.29499649,0.29499649,1.0218979,-46.512249,80.494299)"
          filter="url(#omni-glow)"
        >
          {/* The green core "go" triangle — pulses gently, never moves. */}
          <polygon
            className={styles.core}
            points="210,184.641 150,80.718 90,184.641"
            fill="var(--omni-emerald, #22c55e)"
          />

          {/* The three violet shells — each "explodes" outward from the
              core on a staggered cycle, then snaps back. The CSS variable
              --idx selects the keyframe channel per shell so the timing is
              one declaration in CSS, not three. */}
          <polygon
            className={styles.shell}
            style={{['--idx' as never]: 0}}
            points="254,260.8512 14,191.5692 214,191.5692"
            fill="var(--omni-violet, #a855f7)"
          />
          <polygon
            className={styles.shell}
            style={{['--idx' as never]: 1}}
            points="2,184.641 182,11.436 82,184.641"
            fill="var(--omni-violet-mid, #ba68c8)"
          />
          <polygon
            className={styles.shell}
            style={{['--idx' as never]: 2}}
            points="194,4.5077968 254,246.9948 154,73.789797"
            fill="var(--omni-violet-light, #ce93d8)"
          />
        </g>
      </svg>
    </div>
  );
}
