import { Stepper, StepperActions, useStepper } from '@omnitron-dev/prism/components/stepper';
import { Button } from '@omnitron-dev/prism/ui';

export default function StepperExample() {
  const steps = [{ label: 'Configure' }, { label: 'Review' }, { label: 'Apply' }];
  const stepper = useStepper({ totalSteps: steps.length });
  return <>
    <Stepper steps={steps} activeStep={stepper.activeStep} alternativeLabel />
    {stepper.isCompleted ? <Button onClick={stepper.reset}>Start again</Button> : <StepperActions stepper={stepper} />}
  </>;
}
