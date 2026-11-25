import { NQS_QUESTIONS } from "../../../domain";
import { SafetyQuestions } from "./ParqStep";
import type { QuestionStepProps } from "./ParqStep";

export function NqsStep(props: QuestionStepProps) {
  return <SafetyQuestions {...props} questions={NQS_QUESTIONS} field="nqs" confirmationField="nutritionistConfirmed" />;
}
