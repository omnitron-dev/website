import { DateRangePicker, useDateRangePicker } from '@omnitron-dev/prism/components';
import { Button } from '@omnitron-dev/prism/ui';

export default function DateRangeExample() {
  const range = useDateRangePicker();
  return <>
    <Button onClick={range.onOpen}>{range.label || 'Select reporting dates'}</Button>
    <DateRangePicker {...range} variant="input" title="Reporting period" onSubmit={range.onClose} />
  </>;
}
