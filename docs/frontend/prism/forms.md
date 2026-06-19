---
sidebar_position: 5
title: Forms
description: Schema-aware forms with react-hook-form + zod + Prism Field.
---

# Forms

Prism's form layer is **react-hook-form** + **zod**, plus a `Field`
namespace of RHF-bound input components and an optional i18n provider for
localized validation messages.

:::warning Doc drift — verify against source

The earlier "schema-context drives field inference" model below was
inaccurate. The real surface (`packages/prism/src/forms` +
`packages/prism/src/components/field`) is:

- **`Field` is a namespace** of typed components — `Field.Text`,
  `Field.Select`, `Field.Checkbox`, `Field.Switch`, `Field.Number`,
  `Field.Radio`, `Field.Autocomplete`, `Field.MultiSelect`,
  `Field.Rating`, `Field.Slider`, `Field.DatePicker`, `Field.Code`,
  `Field.Upload`, `Field.Phone`, `Field.Editor`, … — each wired to RHF
  via `name`. There is **no** single schema-aware `<Field name type>`
  that auto-infers control/constraints from zod.
- **`SchemaProvider`** does **not** take a `schema` prop. It supplies an
  i18n `t` / `locale` / `messages` context for validation messages; pair
  it with `useSchema()` to build zod schemas with localized errors. It
  does not feed field rendering.
- Validation is enforced the standard way — `zodResolver(schema)` on
  `useForm`. Fields read errors from RHF, not from a schema context.

The react-hook-form patterns further down (validation modes, `Controller`,
`useFieldArray`, `FormAlert`, submit state) are accurate.
:::

## The pieces

1. **A zod schema** — the source of truth for shape + validation, wired
   in via `zodResolver`.
2. **react-hook-form** — `useForm` + `FormProvider` own the form state.
3. **`Field.*` components** — RHF-bound inputs from the `Field`
   namespace, addressed by `name`.

```tsx
import { Field }       from '@omnitron-dev/prism/components/field';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z }           from 'zod';

const SignInSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(8).max(128),
  remember: z.boolean().optional(),
});

type SignInInput = z.infer<typeof SignInSchema>;

function SignInForm() {
  const form = useForm<SignInInput>({
    resolver:      zodResolver(SignInSchema),
    defaultValues: { email: '', password: '', remember: false },
  });

  const onSubmit = (data: SignInInput) => authService.signIn(data);

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {form.formState.errors.root && (
          <FormAlert error={form.formState.errors.root} />
        )}
        <Field.Text     name="email"    label="Email"    type="email" />
        <Field.Text     name="password" label="Password" type="password" />
        <Field.Checkbox name="remember" label="Remember me" />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          Sign in
        </Button>
      </form>
    </FormProvider>
  );
}
```

## Localized validation messages (optional)

Wrap the form in `<SchemaProvider>` and build schemas via `useSchema()`
to get i18n error messages. The provider takes a `t` function, `locale`,
and `messages` — **not** a `schema`:

```tsx
import { SchemaProvider, useSchema } from '@omnitron-dev/prism/forms';

<SchemaProvider t={t} locale="en">
  <SignInForm />
</SchemaProvider>;

// inside, build the schema with translated messages:
const s = useSchema();
const Schema = z.object({ email: s.email(), password: s.password() });
```

## Field types

Each control is a member of the `Field` namespace:

```tsx
<Field.Text   name="title"    label="Title" />
<Field.Text   name="bio"      label="Bio" multiline rows={4} />
<Field.Text   name="email"    label="Email" type="email" />
<Field.Text   name="password" label="Password" type="password" />
<Field.Number name="age"      label="Age" min={0} max={150} />
<Field.Phone  name="phone"    label="Phone" defaultCountry="US" />
<Field.DatePicker name="dob"  label="Date of birth" />
<Field.Checkbox   name="active" label="Active" />
<Field.Switch     name="newsletter" label="Subscribe" />
<Field.Select name="role" label="Role" options={[
  { value: 'admin', label: 'Admin' },
  { value: 'user',  label: 'User' },
]} />
<Field.MultiSelect name="tags" label="Tags" options={tagOptions} />
<Field.Code   name="otp" label="One-time code" />
<Field.Upload name="avatar" />
```

(Selects take an `options` array; they don't take `<MenuItem>` children.)

For other domain-specific inputs, use the dedicated components:

```tsx
import { DateRangePicker } from '@omnitron-dev/prism/components/date-range-picker';
import { DurationPicker }  from '@omnitron-dev/prism/components/duration-picker';
import { CountrySelect }   from '@omnitron-dev/prism/components/country-select';
import { Editor }          from '@omnitron-dev/prism/components/editor';

<Controller
  name="range"
  control={form.control}
  render={({ field, fieldState }) => (
    <DateRangePicker
      value={field.value}
      onChange={field.onChange}
      error={fieldState.error?.message}
    />
  )}
/>
```

`<Controller>` wires non-`<Field>` inputs into the form state.

## Validation modes

```typescript
useForm({
  resolver: zodResolver(Schema),
  mode:     'onSubmit',    // default — validate on submit only
  // 'onChange'   — validate every keystroke
  // 'onBlur'     — validate when field loses focus
  // 'onTouched'  — onChange after first blur (recommended for sign-in)
  // 'all'        — onChange + onBlur
});
```

Recommendations:
- **`onSubmit`** — short forms, low-friction UX
- **`onTouched`** — most general-purpose; users see errors only
  after engaging with a field
- **`onChange`** — only for password-strength meter or live
  preview cases

## Error display

### Inline per-field

`<Field>` shows error text below the input automatically when
`form.formState.errors[name]` is set.

### Form-level

For root errors (server-side rejections, business-rule
failures), use `<FormAlert>`:

```tsx
const submit = async (data: SignInInput) => {
  try {
    await authService.signIn(data);
  } catch (e) {
    form.setError('root', {
      type:    'server',
      message: e instanceof InvalidTokenError ? 'Invalid credentials' : e.message,
    });
  }
};

return (
  <form onSubmit={form.handleSubmit(submit)}>
    {form.formState.errors.root && (
      <FormAlert error={form.formState.errors.root} />
    )}
    {/* fields */}
  </form>
);
```

**Inline form errors, not toasts** — toasts disappear; the user
needs the error visible while they fix the field.

### Server validation merging

```tsx
catch (e) {
  if (e instanceof ValidationError && e.fieldErrors) {
    for (const [field, message] of Object.entries(e.fieldErrors)) {
      form.setError(field as any, { type: 'server', message });
    }
  } else {
    form.setError('root', { message: 'Something went wrong' });
  }
}
```

Per-field server errors land on the matching `<Field>` exactly
like client-side errors — no special UI path.

## Submit state

```tsx
const { formState: { isSubmitting, isValid, isDirty } } = form;

<Button
  type="submit"
  disabled={isSubmitting || !isValid || !isDirty}
  loading={isSubmitting}
>
  Save
</Button>
```

| State | Meaning |
| ----- | ------- |
| `isSubmitting` | Submission in flight |
| `isValid` | Current values pass schema |
| `isDirty` | At least one field changed from defaults |
| `isSubmitted` | Form has been submitted at least once |
| `isSubmitSuccessful` | Last submit didn't throw |
| `submitCount` | Total submissions |

## Dynamic forms

### Conditional fields

```tsx
const role = form.watch('role');

<>
  <Field.Select name="role" label="Role" options={[
    { value: 'admin', label: 'Admin' },
    { value: 'user',  label: 'User' },
  ]} />

  {role === 'admin' && (
    <Field.Text name="adminScope" label="Admin scope" />
  )}
</>
```

The schema must accept the conditional shape. `z.discriminatedUnion`
is the clean way:

```typescript
const Schema = z.discriminatedUnion('role', [
  z.object({ role: z.literal('admin'), adminScope: z.string() }),
  z.object({ role: z.literal('user') }),
]);
```

### Field arrays

```tsx
import { useFieldArray } from 'react-hook-form';

const { fields, append, remove } = useFieldArray({
  control: form.control,
  name:    'items',
});

<>
  {fields.map((field, index) => (
    <div key={field.id}>
      <Field.Text name={`items.${index}.label`} label="Label" />
      <Field.Text name={`items.${index}.value`} label="Value" />
      <IconButton onClick={() => remove(index)}>
        <DeleteIcon />
      </IconButton>
    </div>
  ))}
  <Button onClick={() => append({ label: '', value: '' })}>
    Add row
  </Button>
</>
```

The schema for the array:

```typescript
items: z.array(z.object({
  label: z.string().min(1),
  value: z.string().min(1),
})).min(1, 'At least one item required').max(10),
```

## Multi-step wizards

```tsx
import { Stepper, Step } from '@omnitron-dev/prism/components/stepper';

const Schema = z.object({
  account: z.object({ email: z.string().email(), password: z.string().min(8) }),
  profile: z.object({ name: z.string().min(1) }),
  plan:    z.enum(['free', 'pro', 'enterprise']),
});

const steps = ['account', 'profile', 'plan'] as const;

function Wizard() {
  const [step, setStep] = useState(0);
  const form = useForm({ resolver: zodResolver(Schema) });

  const next = async () => {
    const stepSchema = Schema.pick({ [steps[step]]: true });
    const ok = await form.trigger(Object.keys(stepSchema.shape) as any);
    if (ok) setStep(s => s + 1);
  };

  return (
    <>
      <Stepper activeStep={step}>
        <Step label="Account" />
        <Step label="Profile" />
        <Step label="Plan" />
      </Stepper>

      {step === 0 && <AccountStep form={form} />}
      {step === 1 && <ProfileStep form={form} />}
      {step === 2 && <PlanStep    form={form} />}

      <Stack direction="row" spacing={2}>
        {step > 0 && <Button onClick={() => setStep(s => s - 1)}>Back</Button>}
        {step < 2 && <Button variant="contained" onClick={next}>Next</Button>}
        {step === 2 && <Button type="submit" variant="contained">Finish</Button>}
      </Stack>
    </>
  );
}
```

`form.trigger(fields)` validates a subset — letting you gate
"Next" without committing to a full submit.

## Patterns

### Password strength meter

```tsx
import { usePasswordVisibility } from '@omnitron-dev/prism/hooks';

const password = form.watch('password');
const strength = getPasswordStrength(password);
const { type, visible, toggle } = usePasswordVisibility();

<Field.Text
  name="password"
  label="Password"
  type={type}
  helperText={<PasswordStrengthBar score={strength} />}
  slotProps={{
    input: {
      endAdornment: (
        <IconButton onClick={toggle} aria-label="Toggle password visibility">
          {visible ? <VisibilityOff /> : <Visibility />}
        </IconButton>
      ),
    },
  }}
/>
```

### Async field validation

For "is this email taken?" checks:

```typescript
const Schema = z.object({
  email: z.string().email()
    .refine(async (email) => !(await isEmailTaken(email)), {
      message: 'Email already taken',
    }),
});
```

Use `mode: 'onBlur'` — every keystroke would hammer the server.

### Optimistic submit

```tsx
const submit = async (data: ProfileInput) => {
  // Optimistic local update
  setLocalUser({ ...user, ...data });
  try {
    await users.update.mutateAsync(data);
  } catch (e) {
    setLocalUser(user);  // rollback
    form.setError('root', { message: 'Could not save changes' });
  }
};
```

## Accessibility

Every `<Field>`:
- Has a programmatic `<label>` (via MUI's TextField).
- Sets `aria-invalid` when in error state.
- Sets `aria-describedby` linking to the error message.
- Supports keyboard navigation natively.

For custom controls wired via `<Controller>`, follow the same
contract — pass `error` + `helperText` props that map to ARIA
attributes.

## Anti-patterns

- **Mixing controlled and uncontrolled fields.** Pick one
  (`<Field>` is controlled via react-hook-form) and stick to it.
- **`mode: 'onChange'` for everything.** Annoying UX; users see
  errors before they finish typing. Use `onTouched` or
  `onSubmit`.
- **Toast for form errors.** Use `<FormAlert>` inline.
- **Custom HTML5 validation on top of zod.** Pick zod; HTML5
  attributes from the schema are for ergonomics only.
- **Re-validating async on every keystroke.** Debounce or move
  to `onBlur`.
- **Storing form state in a global store.** Use react-hook-form
  for form state; lift only the final submitted values.

## See also

- [Components catalog / Field](./components.md#field) — the
  `<Field>` API
- [Hooks catalog](./hooks-catalog.md) — `usePasswordVisibility`,
  `useFocusTrap`, etc.
- [Blocks / AuthBlock](./blocks.md#authblock) —
  prebuilt sign-in flow
- [zod docs](https://zod.dev/) — schema authoring
- [react-hook-form](https://react-hook-form.com/) — form
  state management
