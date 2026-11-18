import { useState } from 'react';
import { useIsClient } from '@omnitron-dev/prism/core';
import { Tabs } from '@omnitron-dev/prism/components/tabs';
import { Box, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@omnitron-dev/prism/ui';

type State = 'Running' | 'Replaced' | 'Restarted' | 'Retained' | 'Not observed';
const roles = [
  ['Guardian', 'Supervises the backend'],
  ['Backend', 'Accepts management requests'],
  ['Owner', 'Supervises application execution'],
  ['Applications', 'Run your services and workers'],
  ['Infrastructure', 'Stores data and serves dependencies'],
] as const;
const scenarios: { id: string; label: string; description: string; states: State[] }[] = [
  { id: 'normal', label: 'Normal operation', description: 'Each component has a separate job. The backend reports observations from the owner; application health needs its own readiness checks.', states: ['Running', 'Running', 'Running', 'Running', 'Running'] },
  { id: 'backend', label: 'Backend update', description: 'During a compatible resident handoff, the guardian replaces the backend. The owner retains application processes. Management clients reconnect to the accepted backend.', states: ['Running', 'Replaced', 'Running', 'Running', 'Retained'] },
  { id: 'owner', label: 'Owner update', description: 'A full runtime transition replaces supervision and restarts the selected applications. This example retains infrastructure and data as declared by the reviewed plan.', states: ['Replaced', 'Replaced', 'Replaced', 'Restarted', 'Retained'] },
  { id: 'disconnected', label: 'Lost connection', description: 'The client cannot establish current state. Applications may still be running. Restore observation and reconcile the operation receipt before retrying a mutation.', states: ['Not observed', 'Not observed', 'Not observed', 'Not observed', 'Not observed'] },
];

/** An illustrative model, never a control or a live status source. */
export function RuntimeArchitecture() {
  const interactive = useIsClient();
  const [selected, setSelected] = useState('normal');
  return <Box component="section" aria-label="Resident execution scenarios" sx={{ border: 1, borderColor: 'divider', borderRadius: 1, minWidth: 0, overflow: 'hidden', my: 3 }}>
    <Box sx={{ px: 2, pt: 2 }}>
      <Typography variant="overline" color="text.secondary">ILLUSTRATED MODEL · NOT LIVE STATUS</Typography>
    </Box>
    <Tabs value={selected} onChange={setSelected} variant="scrollable" scrollButtons="auto" aria-label="Execution scenario" tabs={scenarios.map(scenario => ({
      value: scenario.id, label: scenario.label, disabled: !interactive,
      content: <Box sx={{ px: { xs: 1, sm: 2 }, pb: 1 }}>
        <Typography variant="body2" sx={{ minHeight: { xs: 144, sm: 88 }, pb: 2, lineHeight: 1.7 }}>{scenario.description}</Typography>
        <TableContainer tabIndex={0} aria-label={`${scenario.label}: component responsibilities and state`}>
          <Table size="small" sx={{ tableLayout: { xs: 'fixed', sm: 'auto' }, '& th, & td': { px: { xs: 1, sm: 1.5 } } }}>
            <TableHead><TableRow><TableCell>Component and responsibility</TableCell><TableCell align="right" sx={{ width: { xs: 106, sm: 'auto' } }}>In this scenario</TableCell></TableRow></TableHead>
            <TableBody>{roles.map(([role, responsibility], index) => {
              const state = scenario.states[index];
              return <TableRow key={role}>
                <TableCell component="th" scope="row"><Typography variant="body2" sx={{ fontWeight: 600, display: 'block' }}>{role}</Typography><Typography variant="caption" color="text.secondary">{responsibility}</Typography></TableCell>
                <TableCell align="right"><Chip size="small" variant="outlined" label={state} color={state === 'Not observed' ? 'default' : state === 'Running' || state === 'Retained' ? 'success' : 'warning'} /></TableCell>
              </TableRow>;
            })}</TableBody>
          </Table>
        </TableContainer>
      </Box>,
    }))} />
  </Box>;
}
