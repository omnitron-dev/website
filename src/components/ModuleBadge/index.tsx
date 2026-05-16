import React from 'react';
import styles from './styles.module.css';

/**
 * ModuleBadge — visual classifier rendered at the top of every Titan
 * module documentation page. Communicates three things at a glance:
 *
 *   1. Origin    — built-in / official / community
 *   2. Package   — the npm package name (for copy-paste install)
 *   3. Since     — optional version since which the module exists
 *
 * The three origins map to colour-coded chips:
 *
 *   - built-in   — emerald  (ships inside @omnitron-dev/titan itself)
 *   - official   — violet   (maintained in the omnitron-dev monorepo)
 *   - community  — amber    (third-party contributions)
 */

export type ModuleOrigin = 'built-in' | 'official' | 'community';

interface ModuleBadgeProps {
  origin:   ModuleOrigin;
  pkg:      string;
  subpath?: string;     // e.g. '/module/config' for built-ins
  since?:   string;
  status?:  'stable' | 'experimental' | 'deprecated';
}

const ORIGIN_LABEL: Record<ModuleOrigin, string> = {
  'built-in':  'Built-in',
  'official':  'Official',
  'community': 'Community',
};

const ORIGIN_DESCRIPTION: Record<ModuleOrigin, string> = {
  'built-in':  'Ships inside @omnitron-dev/titan. No additional install required.',
  'official':  'Maintained by the Omnitron team. Independent npm package.',
  'community': 'Third-party module. Read the source before adopting in production.',
};

export default function ModuleBadge({origin, pkg, subpath, since, status}: ModuleBadgeProps) {
  const importPath = subpath ? `${pkg}${subpath}` : pkg;

  return (
    <div className={styles.wrapper}>
      <div className={styles.row}>
        <span className={`${styles.chip} ${styles[`chip-${origin}`]}`}>
          {ORIGIN_LABEL[origin]}
        </span>
        <code className={styles.pkg}>{importPath}</code>
        {since && <span className={styles.meta}>since {since}</span>}
        {status && status !== 'stable' && (
          <span className={`${styles.chip} ${styles[`chip-status-${status}`]}`}>
            {status}
          </span>
        )}
      </div>
      <p className={styles.description}>{ORIGIN_DESCRIPTION[origin]}</p>
    </div>
  );
}
