import { useState } from 'react';
import { Menu, useMenu } from '@omnitron-dev/prism/components';
import { Button } from '@omnitron-dev/prism/ui';

export default function MenuExample() {
  const menu = useMenu();
  const [sort, setSort] = useState('Name');
  return <>
    <Button onClick={menu.handleOpen} aria-haspopup="menu" aria-expanded={menu.open}>Sort by {sort}</Button>
    <Menu {...menu.menuProps} items={['Name', 'Latency'].map(label => ({ key: label, label, onClick: () => setSort(label) }))} />
  </>;
}
