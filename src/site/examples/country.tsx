import { useState } from 'react';
import { CountrySelect } from '@omnitron-dev/prism/components';

const options = [
  { iso2: 'fi', en: 'Finland', ru: 'Финляндия' },
  { iso2: 'fr', en: 'France', ru: 'Франция' },
  { iso2: 'ca', en: 'Canada', ru: 'Канада' },
];

export default function CountryExample() {
  const [value, setValue] = useState<string | null>('fi');
  return <><CountrySelect label="Region" options={options} value={value} onChange={setValue} /><output>{value ?? 'None selected'}</output></>;
}
