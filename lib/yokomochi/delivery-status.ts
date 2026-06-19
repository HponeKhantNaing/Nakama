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

/** Progress index for tracking UI — driver leg complete at warehouse arrival. */
export function getDeliveryTrackingStepIndex(
  taskStatus: string,
  verificationStatus?: string | null
): number {
  if (taskStatus === 'COMPLETED' || verificationStatus === 'APPROVED') {
    return DRIVER_TASK_STEPS.length - 1;
  }
  if (taskStatus === 'ARRIVED_WAREHOUSE') {
    return DRIVER_TASK_STEPS.indexOf('ARRIVED_WAREHOUSE');
  }
  return getDriverTaskStepIndex(taskStatus);
}

export function formatDriverTaskStatus(status: string): string {
  return status.replace(/_/g, ' ');
}
