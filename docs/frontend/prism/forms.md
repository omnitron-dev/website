---
sidebar_position: 5
title: Forms
description: Schema-aware forms with react-hook-form + zod + Prism Field.
---

# Forms

Prism's form layer is **react-hook-form** + **zod**, plus a `Field`
namespace of RHF-bound input components and an optional i18n provider
(`SchemaProvider`) for localized validation messages.

There is **no** schema-driven field inference. You write a zod schema,
wire it into `useForm` via `zodResolver`, and place `Field.*` components
addressed by `name`. Validation runs through the resolver; each `Field`
reads its own error from react-hook-form state and renders it inline.

## The pieces

1. **A zod schema** — the source of truth for shape + validation, wired
   in via `zodResolver`.
2. **react-hook-form** — `useForm` + `FormProvider` own the form state.
   `Field.*` components call `useFormContext()` internally, so they must
   be rendered inside a `<FormProvider>`.
3. **`Field.*` components** — RHF-bound inputs from the `Field`
   namespace, addressed by `name`.

`Field` is exported from the package root and from the `components`
subpath. `zodResolver` comes from `@hookform/resolvers/zod` — it is a
dependency of Prism but is **not** re-exported, so import it directly
(this is the same import Prism's own blocks use):

```tsx
import { Field } from '@omnitron-dev/prism';            // namespace
// or: import { Field } from '@omnitron-dev/prism/components/field';
import { FormAlert } from '@omnitron-dev/prism';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

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
          <FormAlert>{form.formState.errors.root.message}</FormAlert>
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

:::note `FormAlert` takes the message as **children**
`<FormAlert>` does not accept an `error` prop. The message is its
`children`. react-hook-form errors are `FieldError` objects, so pass
`errors.root.message` (a string), not the error object itself. See
[Error display](#error-display) below.
:::

## Localized validation messages (optional)

`SchemaProvider` does **not** take a `schema` prop and does **not** drive
field rendering. It supplies an i18n context — a translate function `t`,
a `locale`, and optional `messages` overrides — that produces a set of
pre-translated zod schema builders. Read them with `useSchema()`, which
returns `{ t, locale, schema }`, and compose your form schema from
`schema.*` helpers so validation errors come out localized.

```tsx
import { SchemaProvider, useSchema } from '@omnitron-dev/prism/forms';
import { useTranslation } from 'react-i18next';

function App() {
  const { t, i18n } = useTranslation();
  return (
    <SchemaProvider t={t} locale={i18n.language}>
      <SignInForm />
    </SchemaProvider>
  );
}

// inside a form, build the schema with translated messages:
function useSignInSchema() {
  const { schema } = useSchema();           // throws if no provider
  return z.object({
    email:    schema.email(),               // localized "required"/"invalid"
    password: schema.password({ minLength: 8 }),
  });
}
```

The `schema` helper exposes builders such as `email()`, `phone()`,
`date()` / `dateOptional()`, `boolean()` / `booleanOptional()`,
`editor()`, `file()` / `fileOptional()` / `files()`, `url()` /
`urlOptional()`, `password()`, `required()`, `sliderRange()`,
`nullableInput()`, and `confirm()` — each accepting per-call message
overrides. Without an i18n library you can still get default English
messages via the standalone factory:

```ts
import { createSchemaUtils } from '@omnitron-dev/prism/forms';

const schema = createSchemaUtils();          // English defaults
const userSchema = z.object({ email: schema.email() });
```

`useSchemaOptional()` is the non-throwing variant — it returns `null`
outside a provider, for components that may render either way.

## Field types

Each control is a member of the `Field` namespace. Every field takes a
`name` (the RHF path), reads its error from react-hook-form, and renders
the error message inline below the control. Most pass extra props through
to the underlying MUI component; text-like fields also accept an optional
`rules` prop (react-hook-form `RegisterOptions`) for inline validation.

```tsx
<Field.Text   name="title"    label="Title" />
<Field.Text   name="bio"      label="Bio" multiline rows={4} />
<Field.Text   name="email"    label="Email" type="email" />
<Field.Text   name="password" label="Password" type="password" />
<Field.Number name="age"      label="Age" min={0} max={150} />
<Field.Phone  name="phone"    label="Phone" defaultCountry="US" />
<Field.DatePicker name="dob"  label="Date of birth" />
<Field.Checkbox   name="active"     label="Active" />
<Field.Switch     name="newsletter" label="Subscribe" />
<Field.Select name="role" label="Role" options={[
  { value: 'admin', label: 'Admin' },
  { value: 'user',  label: 'User' },
]} />
<Field.Radio name="plan" label="Plan" options={[
  { value: 'free', label: 'Free' },
  { value: 'pro',  label: 'Pro' },
]} />
<Field.MultiSelect name="tags" label="Tags" options={tagOptions} />
<Field.Code   name="otp" length={6} />
<Field.Upload name="avatar" />
```

The full namespace (`packages/prism/src/components/field/index.ts`):

| Member | Component | Notes |
| ------ | --------- | ----- |
| `Field.Text` | text input | MUI `TextField`; `type`, `multiline`, `rows` pass through |
| `Field.Number` | numeric input | `min`/`max`/`decimals`/`allowNegative`; stores a `number` |
| `Field.Select` | dropdown | `options: { value, label, disabled? }[]` + `placeholder` |
| `Field.Checkbox` | checkbox | `label`, `helperText`, `indeterminate` |
| `Field.Switch` | toggle | `label`, `labelPlacement` |
| `Field.Radio` | radio group | `options: { value, label, disabled? }[]`, `row` |
| `Field.Autocomplete` | searchable select | `options`, `loading`, `noOptionsText` |
| `Field.MultiSelect` | multi-select with chips | `options`, `maxSelections`, `limitTags` |
| `Field.Rating` | star rating | `showValue` |
| `Field.Slider` | range slider | `showValue`, `unit`, `formatValue` |
| `Field.DatePicker` | date picker (MUI X) | stores ISO string; `minDate`/`maxDate`/`disablePast` |
| `Field.TimePicker` | time picker (MUI X) | |
| `Field.DateTimePicker` | combined date-time (MUI X) | |
| `Field.MultiCheckbox` | checkbox group | |
| `Field.MultiSwitch` | switch group | |
| `Field.Code` | OTP / PIN input | `length`, `type` |
| `Field.Upload` | dropzone upload | `multiple`, `thumbnail`; value is `File`/`File[]`/URL |
| `Field.UploadBox` | compact upload box | |
| `Field.UploadAvatar` | circular avatar upload | |
| `Field.Phone` | international phone | `defaultCountry`, `preferredCountries` |
| `Field.CountrySelect` | country selector | |
| `Field.Editor` | rich text editor | textarea fallback or custom |
| `Field.CustomEditor` | headless editor | render-prop |

(Select / Radio / MultiSelect / Autocomplete take an `options` array;
they do **not** take `<MenuItem>` children.)

For inputs without a `Field.*` wrapper, drop to `<Controller>` (or
`useController`) and wire the field manually:

```tsx
import { Controller } from 'react-hook-form';
import { DateRangePicker } from '@omnitron-dev/prism/components/date-range-picker';

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

Every `Field.*` component renders its error message automatically below
the input when `form.formState.errors[name]` is set — it reads
`fieldState.error` from the internal `<Controller>` and feeds the message
into the MUI control's `helperText` (with `error`, `aria-invalid`, and
`aria-describedby` wired up). No extra markup needed.

### Form-level

For root errors (server-side rejections, business-rule failures), use
`<FormAlert>`. It is the platform's canonical inline surface for
form-level errors (per the Error-UX policy: form failures inline via
`FormAlert`, background events via toast). The message is passed as
**children**:

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
      <FormAlert onClose={() => form.clearErrors('root')}>
        {form.formState.errors.root.message}
      </FormAlert>
    )}
    {/* fields */}
  </form>
);
```

`<FormAlert>` props (`packages/prism/src/components/alert/alert.tsx`):

| Prop | Type | Default | Notes |
| ---- | ---- | ------- | ----- |
| `children` | `ReactNode` | — | The alert body — the error message goes here |
| `severity` | `'error' \| 'warning' \| 'info' \| 'success'` | `'error'` | |
| `title` | `ReactNode` | — | Optional heading above the message |
| `onClose` | `() => void` | — | Renders a close (×) button; should clear the error |
| `autoScroll` | `boolean` | `true` | Scrolls the alert into view on mount |
| `sx` | `SxProps` | — | Style overrides |

It sets `role="alert"` + `aria-live="assertive"` so screen readers
announce the message immediately, and auto-scrolls into view so an error
below the fold isn't missed.

**Inline form errors, not toasts** — toasts disappear; the user needs
the error visible while they fix the field.

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

Per-field server errors land on the matching `Field.*` exactly like
client-side errors — no special UI path; the field renders them inline.

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

`Field.*` components address array members by index path
(`items.0.label`, `items.1.label`, …), so they compose directly with
react-hook-form's `useFieldArray`:

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
import { Stepper } from '@omnitron-dev/prism/components/stepper';

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
    // validate just this step's fields before advancing
    const ok = await form.trigger(steps[step] as any);
    if (ok) setStep(s => s + 1);
  };

  return (
    <FormProvider {...form}>
      <Stepper
        activeStep={step}
        steps={[
          { label: 'Account', description: 'Email and password' },
          { label: 'Profile', description: 'Your name' },
          { label: 'Plan' },
        ]}
      />

      {step === 0 && <AccountStep />}
      {step === 1 && <ProfileStep />}
      {step === 2 && <PlanStep />}

      <Stack direction="row" spacing={2}>
        {step > 0 && <Button onClick={() => setStep(s => s - 1)}>Back</Button>}
        {step < 2 && <Button variant="contained" onClick={next}>Next</Button>}
        {step === 2 && <Button type="submit" variant="contained">Finish</Button>}
      </Stack>
    </FormProvider>
  );
}
```

`form.trigger(name)` validates a subset — letting you gate "Next"
without committing to a full submit. (Step components read state via
`useFormContext()`, so they need no `form` prop.)

## Patterns

### Password visibility toggle

`usePasswordVisibility()` returns `{ visible, toggle, show, hide, type }`
— state and handlers only, **no** rendered button. Supply your own
`IconButton` in the field's `endAdornment` and drive the input `type`
from the hook:

```tsx
import { usePasswordVisibility } from '@omnitron-dev/prism/hooks';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';

function PasswordField() {
  const password = usePasswordVisibility();   // { visible, toggle, type, ... }
  const value    = form.watch('password');
  const strength = getPasswordStrength(value);

  return (
    <Field.Text
      name="password"
      label="Password"
      type={password.type}                      // 'text' | 'password'
      helperText={<PasswordStrengthBar score={strength} />}
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton onClick={password.toggle} aria-label="Toggle password visibility">
                {password.visible ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
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

Every `Field.*`:
- Has a programmatic `<label>` (via MUI's `TextField` / `FormControlLabel`).
- Sets `aria-invalid` when in error state.
- Sets `aria-describedby` linking to the helper/error message.
- Sets `aria-required` when `required` is passed.
- Supports keyboard navigation natively.

For custom controls wired via `<Controller>`, follow the same contract —
pass `error` + `helperText` props that map to ARIA attributes.

## Anti-patterns

- **Mixing controlled and uncontrolled fields.** Pick one (`Field.*` is
  controlled via react-hook-form) and stick to it.
- **`mode: 'onChange'` for everything.** Annoying UX; users see errors
  before they finish typing. Use `onTouched` or `onSubmit`.
- **Toast for form errors.** Use `<FormAlert>` inline (message via
  children).
- **Passing an `error` object to `<FormAlert>`.** It has no `error`
  prop — pass the message string as children.
- **Expecting `SchemaProvider` to validate or render fields.** It only
  supplies localized messages; validation is still `zodResolver`.
- **Custom HTML5 validation on top of zod.** Pick zod; HTML5 attributes
  from the schema are for ergonomics only.
- **Re-validating async on every keystroke.** Debounce or move to
  `onBlur`.
- **Storing form state in a global store.** Use react-hook-form for form
  state; lift only the final submitted values.

## See also

- [Components catalog / Field](./components.md#field) — the `Field` API
- [Hooks catalog](./hooks-catalog.md) — `usePasswordVisibility`,
  `useFocusTrap`, etc.
- [Blocks / AuthBlock](./blocks.md#authblock) — prebuilt sign-in flow
- [zod docs](https://zod.dev/) — schema authoring
- [react-hook-form](https://react-hook-form.com/) — form state management
