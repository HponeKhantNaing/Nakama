export const DRIVER_TASK_STEPS = [
  'ASSIGNED',
  'ARRIVED_FACTORY',
  'LOADED_CARGO',
  'IN_TRANSIT',
  'ARRIVED_WAREHOUSE',
  'COMPLETED',
] as const;

export type DriverTaskStep = (typeof DRIVER_TASK_STEPS)[number];

export function getDriverTaskStepIndex(status: string): number {
  const index = DRIVER_TASK_STEPS.indexOf(status as DriverTaskStep);
  return index === -1 ? 0 : index;
}

export function formatDriverTaskStatus(status: string): string {
  return status.replace(/_/g, ' ');
}
