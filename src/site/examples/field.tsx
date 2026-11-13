import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Field } from '@omnitron-dev/prism/components';
import { Button, Stack } from '@omnitron-dev/prism/ui';

export default function FieldExample() {
  const form = useForm({ defaultValues: { name: 'Gateway', enabled: true } });
  const [result, setResult] = useState('');
  return <FormProvider {...form}><Stack component="form" spacing={1}
    onSubmit={form.handleSubmit(values => setResult(values.name + (values.enabled ? ' is enabled' : ' is paused')))}>
    <Field.Text name="name" label="Service name" required />
    <Field.Switch name="enabled" label="Enabled" />
    <Button type="submit">Save service</Button><output>{result}</output>
  </Stack></FormProvider>;
}
