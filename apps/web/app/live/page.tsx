import { LiveScreen } from './LiveScreen';

export const metadata = {
  title: 'Live — PV Manager',
  description: 'Real-time solar system status',
};

export default function LivePage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  return <LiveScreen searchParams={searchParams} />;
}
