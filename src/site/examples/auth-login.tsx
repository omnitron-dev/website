import React, { useState } from 'react';
import { AuthBlock } from '@omnitron-dev/prism/blocks';
import { Alert, Button, Stack } from '@omnitron-dev/prism/ui';

export default function AuthLoginExample() {
  const [submitted, setSubmitted] = useState(false);
  if (submitted) return <Stack spacing={1}>
    <Alert severity="success">Demo form validated locally.</Alert>
    <Button onClick={() => setSubmitted(false)}>Try again</Button>
  </Stack>;

  return <Stack spacing={1}>
    <p>Try <code>reader@example.test</code> with any sample password. This form runs entirely in your browser.</p>
    <AuthBlock.Login onSubmit={() => setSubmitted(true)} showRememberMe={false} showForgotPassword={false}
      labels={{ email: 'Demo email', password: 'Sample password', submit: 'Validate locally' }} />
  </Stack>;
}
