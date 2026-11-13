import { ChangelogEntry, ChangelogTimeline } from '@omnitron-dev/prism/components';

export default function ChangelogExample() {
  return <ChangelogTimeline>
    <ChangelogEntry version="1.1.0" date="2026-05-16">Added per-stack diagnostics.</ChangelogEntry>
    <ChangelogEntry version="1.0.0" date="2026-05-10">Published the first sample.</ChangelogEntry>
  </ChangelogTimeline>;
}
