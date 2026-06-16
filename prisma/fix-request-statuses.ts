import { OrderStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { computeRequestStatus, calculateRequestProgress } from '../lib/tms/request-compute';

async function main() {
  const requests = await prisma.transportRequest.findMany({
    include: {
      truckAssignments: {
        include: { assignmentConfirmation: { select: { approved: true } } },
      },
    },
  });

  let fixed = 0;
  for (const r of requests) {
    const nextStatus = computeRequestStatus({
      requestStatus: r.status,
      assignments: r.truckAssignments,
      totalQuantity: r.totalQuantity,
      totalWeight: r.cargoWeight,
    });
    const nextProgress = calculateRequestProgress({
      totalWeight: r.cargoWeight,
      assignments: r.truckAssignments,
    });

    if (nextStatus !== r.status || nextProgress !== (r.progressPercent ?? 0)) {
      await prisma.transportRequest.update({
        where: { id: r.id },
        data: {
          status: nextStatus,
          progressPercent: nextProgress,
          deliveredAt: nextStatus === OrderStatus.DELIVERED ? r.deliveredAt ?? new Date() : null,
        },
      });
      console.log(`Fixed ${r.requestNo}: ${r.status} → ${nextStatus} (${nextProgress}%)`);
      fixed++;
    }
  }

  console.log(`Done. Updated ${fixed} request(s).`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
