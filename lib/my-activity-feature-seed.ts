import type { GiftStatus } from "@/components/daily-gift-box";
import type { CorrectiveExerciseResponse } from "@/components/corrective-exercise-application";
import type { TimeMachineStatus } from "@/components/time-machine-goal-box";

// In-memory handoff only. Never persist account-specific data in shared browser storage.
export type MyActivityFeatureSeed = {
  correctiveRequest?: Promise<CorrectiveExerciseResponse>;
  correctiveStatus?: CorrectiveExerciseResponse;
  timeMachineRequest?: Promise<TimeMachineStatus>;
  timeMachineStatus?: TimeMachineStatus;
  giftStatus?: GiftStatus | null;
  onTimeMachineChange?: (status: TimeMachineStatus) => void;
  onGiftChange?: (status: GiftStatus) => void;
};
