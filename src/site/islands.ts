import { DiskFlowTrace } from './disk-flow-trace.tsx';
import { RuntimeArchitecture } from './runtime-architecture.tsx';
import { PrismExample } from './prism-example.tsx';

// Shared by the static renderer and browser; deferred examples remain opt-in.
export const documentIslands = { PrismExample, RuntimeArchitecture, DiskFlowTrace };
