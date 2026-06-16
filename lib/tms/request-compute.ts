import { AssignmentStatus, OrderStatus } from '@prisma/client';

export type AssignmentSnapshot = {
  status: AssignmentStatus | string;
  assignedWeight: number;
  assignedQuantity: number;
  assignmentConfirmation?: { approved: boolean } | null;
};

export function isActiveAssignment(status: AssignmentStatus | string) {
  return status !== AssignmentStatus.CANCELLED;
}

export function canCancelAssignment(assignment: AssignmentSnapshot) {
  const cancellable = [AssignmentStatus.PENDING, AssignmentStatus.ASSIGNED];
  if (!cancellable.includes(assignment.status as AssignmentStatus)) return false;
  if (assignment.assignmentConfirmation?.approved) return false;
  return true;
}

export function activeAssignments(assignments: AssignmentSnapshot[]) {
  return (assignments ?? []).filter((a) => isActiveAssignment(a.status));
}

export function computeRequestStatus(input: {
  requestStatus: OrderStatus;
  assignments: AssignmentSnapshot[];
  totalQuantity?: number;
  totalWeight?: number;
}): OrderStatus {
  const assignments = activeAssignments(input.assignments);
  const totalQty = input.totalQuantity ?? 0;
  const totalWeight = input.totalWeight ?? 0;

  if (assignments.length === 0) {
    if (input.requestStatus === OrderStatus.PENDING) return OrderStatus.PENDING;
    if (input.requestStatus === OrderStatus.CANCELLED) return OrderStatus.CANCELLED;
    return OrderStatus.SHINWA_ACCEPTED;
  }

  const deliveredQty = assignments
    .filter((a) => a.status === AssignmentStatus.DELIVERED)
    .reduce((s, a) => s + (a.assignedQuantity ?? 0), 0);
  const deliveredWeight = assignments
    .filter((a) => a.status === AssignmentStatus.DELIVERED)
    .reduce((s, a) => s + (a.assignedWeight ?? 0), 0);
  const assignedQty = assignments.reduce((s, a) => s + (a.assignedQuantity ?? 0), 0);
  const assignedWeight = assignments.reduce((s, a) => s + (a.assignedWeight ?? 0), 0);

  const cargoFullyDelivered =
    totalQty > 0
      ? deliveredQty >= totalQty
      : totalWeight > 0
        ? deliveredWeight >= totalWeight
        : false;

  const fullyAllocated =
    totalQty > 0
      ? assignedQty >= totalQty
      : totalWeight > 0
        ? assignedWeight >= totalWeight
        : assignments.length > 0;

  const allDelivered = assignments.every((a) => a.status === AssignmentStatus.DELIVERED);
  const allConfirmed =
    allDelivered &&
    assignments.every((a) => a.assignmentConfirmation?.approved === true);

  const anyInTransit = assignments.some((a) =>
    [AssignmentStatus.IN_TRANSIT, AssignmentStatus.ARRIVED].includes(a.status as AssignmentStatus)
  );
  if (anyInTransit) return OrderStatus.IN_TRANSIT;

  const anyPickedUp = assignments.some((a) => a.status === AssignmentStatus.PICKED_UP);
  if (anyPickedUp) return OrderStatus.PICKED_UP;

  const anyDispatched = assignments.some((a) => a.status === AssignmentStatus.DISPATCHED);
  if (anyDispatched) return OrderStatus.DISPATCHED;

  // Entire request is DELIVERED only when ALL cargo is delivered and confirmed
  if (cargoFullyDelivered && allConfirmed) return OrderStatus.DELIVERED;
  if (cargoFullyDelivered && allDelivered) return OrderStatus.AWAITING_CONFIRMATION;

  // Partial delivery or open capacity — more trucks/drivers may be needed
  if (!cargoFullyDelivered || !fullyAllocated) {
    const anyDelivered = deliveredQty > 0 || deliveredWeight > 0;
    const allAssigned = assignments.every((a) => a.status === AssignmentStatus.ASSIGNED);
    if (allAssigned && fullyAllocated) return OrderStatus.DRIVER_ASSIGNED;
    if (anyDelivered || !fullyAllocated) return OrderStatus.SPLIT;
  }

  const allAssigned = assignments.every((a) => a.status === AssignmentStatus.ASSIGNED);
  if (allAssigned) return OrderStatus.DRIVER_ASSIGNED;

  return OrderStatus.PENDING;
}

export function calculateRequestProgress(input: {
  totalWeight: number;
  assignments: AssignmentSnapshot[];
}): number {
  const total = Math.max(0, input.totalWeight ?? 0);
  if (total <= 0) return 0;

  const deliveredWeight = (input.assignments ?? []).reduce((s, a) => {
    if (!isActiveAssignment(a.status)) return s;
    if (a.status === AssignmentStatus.DELIVERED) return s + (a.assignedWeight ?? 0);
    return s;
  }, 0);

  const percent = (deliveredWeight / total) * 100;
  const rounded = Math.round(percent);
  return Math.max(0, Math.min(100, rounded));
}

export function calculateAllocationRemaining(input: {
  totalWeight: number;
  totalQuantity: number;
  assignments: AssignmentSnapshot[];
}) {
  const active = activeAssignments(input.assignments);
  const assignedWeight = active.reduce((s, a) => s + (a.assignedWeight ?? 0), 0);
  const assignedQty = active.reduce((s, a) => s + (a.assignedQuantity ?? 0), 0);
  return {
    allocationRemainingWeight: Math.max(0, (input.totalWeight ?? 0) - assignedWeight),
    allocationRemainingQuantity: Math.max(0, (input.totalQuantity ?? 0) - assignedQty),
    isFullyAllocated:
      (input.totalQuantity ?? 0) > 0
        ? assignedQty >= (input.totalQuantity ?? 0)
        : assignedWeight >= (input.totalWeight ?? 0),
  };
}

export function calculateRemaining(input: {
  totalWeight: number;
  totalQuantity: number;
  assignments: AssignmentSnapshot[];
}) {
  const assignedWeight = (input.assignments ?? []).reduce((s, a) => s + (a.assignedWeight ?? 0), 0);
  const assignedQty = (input.assignments ?? []).reduce((s, a) => s + (a.assignedQuantity ?? 0), 0);

  const deliveredWeight = (input.assignments ?? []).reduce((s, a) => {
    if (!isActiveAssignment(a.status)) return s;
    if (a.status === AssignmentStatus.DELIVERED) return s + (a.assignedWeight ?? 0);
    return s;
  }, 0);

  const deliveredQty = (input.assignments ?? []).reduce((s, a) => {
    if (!isActiveAssignment(a.status)) return s;
    if (a.status === AssignmentStatus.DELIVERED) return s + (a.assignedQuantity ?? 0);
    return s;
  }, 0);

  return {
    remainingWeight: Math.max(0, (input.totalWeight ?? 0) - deliveredWeight),
    remainingQuantity: Math.max(0, (input.totalQuantity ?? 0) - deliveredQty),
    assignedWeight,
    assignedQuantity: assignedQty,
    deliveredWeight,
    deliveredQuantity: deliveredQty,
  };
}

export function isAssignmentDelivered(status: string) {
  return status === AssignmentStatus.DELIVERED;
}

