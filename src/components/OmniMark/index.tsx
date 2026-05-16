import React from 'react';
import styles from './styles.module.css';

interface OmniMarkProps {
  size?: number;
  className?: string;
}

/**
 * Omnitron hero mark — animated logo with cyberpunk-styled atmospheric
 * bloom.
 *
 * The mark is four polygons: a green core surrounded by three violet
 * triangles. Hovering the figure extrudes the three shells outward in
 * a staggered sequence while the ambient float animation pauses, so
 * the extrusion reads cleanly without competing motion.
 *
 * Layered behind the mark:
 *   1. Outer atmospheric cloud (slow breathe)
 *   2. Mid chromatic aberration halo (drift)
 *   3. Inner donut-shaped glow (pulse)
 *
 * The figure sits inside a 500×500 viewBox with a skew matrix that
 * tilts the polygons into the resting pose. Animations are pure CSS
 * keyframes — no JS animation loop.
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

        {/* The affine transform tilts the figure ~16° clockwise and
            re-centres it inside the viewBox. The expanded viewBox
            leaves room around the figure so the shell-extrude motions
            don't clip. */}
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
