import { TrackingPageClient } from './tracking-client';

export default function TrackingPage({ params }: { params: { id: string } }) {
  return <TrackingPageClient requestId={params.id} />;
}
