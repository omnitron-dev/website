import { Tabs, TabPanel } from '@omnitron-dev/prism/components/tabs';

export default function TabsExample() {
  return <Tabs defaultValue="nodes" aria-label="Example stack inventory">
    <TabPanel value="nodes" label="Nodes">2 connected nodes</TabPanel>
    <TabPanel value="apps" label="Apps">6 running applications</TabPanel>
  </Tabs>;
}
