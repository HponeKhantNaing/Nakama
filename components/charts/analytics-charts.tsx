'use client';

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnalyticsData } from '@/types';
import { useTranslation } from '@/lib/i18n/context';

const COLORS = ['#FF6B4A', '#7C8CF8', '#34D399', '#FBBF24', '#F87171'];

interface AnalyticsChartsProps {
  data: AnalyticsData;
}

export function AnalyticsCharts({ data }: AnalyticsChartsProps) {
  const { t } = useTranslation();

  const subcontractData = data.subcontractRatio.map((item) => ({
    ...item,
    name: item.name === 'Direct' ? t('analytics.direct') : t('analytics.subcontractedLabel'),
  }));

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t('analytics.monthlyCompleted')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.monthlyCompletedOrders}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" fontSize={12} tick={{ fill: '#717171' }} />
              <YAxis tick={{ fill: '#717171' }} />
              <Tooltip />
              <Bar dataKey="count" fill="#FF6B4A" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('analytics.costTrend')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data.transportCostTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" fontSize={12} tick={{ fill: '#717171' }} />
              <YAxis tick={{ fill: '#717171' }} />
              <Tooltip
                formatter={(value: number) => [`¥${value.toLocaleString()}`, t('analytics.cost')]}
              />
              <Line type="monotone" dataKey="cost" stroke="#34D399" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('analytics.fleetUsage')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.fleetUsage} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" unit="%" tick={{ fill: '#717171' }} />
              <YAxis dataKey="vehicle" type="category" width={100} fontSize={11} tick={{ fill: '#717171' }} />
              <Tooltip />
              <Bar dataKey="usage" fill="#7C8CF8" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('analytics.subcontractRatio')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={subcontractData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                dataKey="value"
              >
                {subcontractData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>{t('analytics.driverPerformance')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.driverPerformance}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="driver" fontSize={12} tick={{ fill: '#717171' }} />
              <YAxis tick={{ fill: '#717171' }} />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="deliveries"
                fill="#FF6B4A"
                name={t('analytics.deliveries')}
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

export function AnalyticsSummary({ data }: AnalyticsChartsProps) {
  const { t } = useTranslation();
  const totalCompleted = data.monthlyCompletedOrders.reduce((sum, m) => sum + m.count, 0);
  const totalCost = data.transportCostTrend.reduce((sum, m) => sum + m.cost, 0);
  const subcontracted =
    data.subcontractRatio.find((r) => r.name === 'Subcontracted')?.value ?? 0;

  const stats = [
    { label: t('analytics.completedOrders'), value: totalCompleted, accent: false },
    { label: t('analytics.totalCost'), value: `¥${totalCost.toLocaleString()}`, accent: false },
    { label: t('analytics.delayedOrders'), value: data.delayedOrders, accent: true },
    { label: t('analytics.subcontracted'), value: subcontracted, accent: false },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p
              className={`mt-1 text-3xl font-bold ${stat.accent ? 'text-primary' : 'text-foreground'}`}
            >
              {stat.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
