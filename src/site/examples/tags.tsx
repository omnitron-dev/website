import { useState } from 'react';
import { TagCloud } from '@omnitron-dev/prism/components';

const tags = [
  { id: 'rpc', name: 'RPC', slug: 'rpc', postCount: 12 },
  { id: 'ui', name: 'UI', slug: 'ui', postCount: 8 },
];

export default function TagsExample() {
  const [chosen, setChosen] = useState('All topics');
  return <><TagCloud tags={tags} onTagClick={tag => setChosen(tag.name)} /><output>{chosen}</output></>;
}
