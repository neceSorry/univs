import React, { useState } from 'react';
import { Tabs, Card, Typography, Row, Col, Statistic, Table, Button, Space, Tag, Segmented } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/api.client';
import { HierarchyFilter } from '../../components/common/HierarchyFilter';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import * as XLSX from 'xlsx';

const { Title } = Typography;


export const AnalyticsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('1');

  return (
    <div>
      <Title level={2}>Аналитика и дашборды</Title>
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <Tabs.TabPane tab="Рейтинг студентов" key="1"><RankingTab /></Tabs.TabPane>
        <Tabs.TabPane tab="Общая статистика" key="2"><GeneralStatsTab /></Tabs.TabPane>
        <Tabs.TabPane tab="Финансы" key="4"><FinanceTab /></Tabs.TabPane>
      </Tabs>
    </div>
  );
};

const exportToExcel = (data: any[], filename: string) => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

// --- TAB 1 ---
const RankingTab: React.FC = () => {
  const [filter, setFilter] = useState<any>({});
  
  const { data: ranking, isLoading } = useQuery({
    queryKey: ['analytics-ranking', filter],
    queryFn: () => apiClient.get(`/analytics/gpa-ranking?scope=group&scopeId=${filter.groupId || ''}`).then(res => res.data.data),
  });

  const columns = [
    { title: 'Место', dataIndex: 'rank', render: (r: number) => {
        if (r === 1) return <Tag color="gold">🥇 1</Tag>;
        if (r === 2) return <Tag color="silver">🥈 2</Tag>;
        if (r === 3) return <Tag color="orange">🥉 3</Tag>;
        return <Tag>{r}</Tag>;
      }
    },
    { title: 'ФИО', dataIndex: 'name' },
    { title: 'Группа', dataIndex: 'group' },
    { title: 'GPA', dataIndex: 'gpa', render: (v: number | null) => v != null ? <strong>{v.toFixed(2)}</strong> : '—' },
    { title: 'Посещаемость', dataIndex: 'attendance_rate', render: (v: number) => `${v}%` },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <HierarchyFilter levels={['institute', 'department', 'program', 'group']} onChange={setFilter} />
        <Button onClick={() => exportToExcel(ranking || [], 'gpa_ranking')}>Экспорт в Excel</Button>
      </Space>
      <Table 
        columns={columns} 
        dataSource={ranking || []} 
        rowKey="id" 
        loading={isLoading} 
        rowClassName={(_, index) => index < 10 ? 'top-10-row' : ''}
        pagination={false}
      />
    </div>
  );
};

type StatsFilter = 'all' | 'status' | 'enrollment' | 'study_form' | 'course' | 'institute';

// --- TAB 2 ---
const GeneralStatsTab: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState<StatsFilter>('all');

  const { data: stats } = useQuery({
    queryKey: ['analytics-stats'],
    queryFn: () => apiClient.get('/analytics/students-stats').then(res => res.data.data),
  });

  if (!stats) return null;

  const enrollmentData = [
    { name: 'Бюджет', value: stats.by_enrollment.budget },
    { name: 'Контракт', value: stats.by_enrollment.contract },
  ];

  const studyFormData = [
    { name: 'Очная', value: stats.by_study_form.full_time },
    { name: 'Заочная', value: stats.by_study_form.part_time },
  ];

  const courseData = [
    { course: '1 курс', count: stats.by_course['1'] },
    { course: '2 курс', count: stats.by_course['2'] },
    { course: '3 курс', count: stats.by_course['3'] },
    { course: '4 курс', count: stats.by_course['4'] },
  ];

  const statusData = [
    { name: 'Активных', value: stats.by_status.active, color: '#3f8600' },
    { name: 'Отчисленных', value: stats.by_status.expelled, color: '#cf1322' },
    { name: 'Академический отпуск', value: stats.by_status.academic_leave ?? 0, color: '#faad14' },
  ];

  const segmentOptions = [
    { label: 'Все студенты', value: 'all' },
    { label: 'По статусу', value: 'status' },
    { label: 'Тип финансирования', value: 'enrollment' },
    { label: 'Форма обучения', value: 'study_form' },
    { label: 'По курсам', value: 'course' },
    { label: 'По институтам', value: 'institute' },
  ];

  return (
    <div>
      {/* Filter selector */}
      <div style={{ marginBottom: 16 }}>
        <Segmented
          options={segmentOptions}
          value={activeFilter}
          onChange={v => setActiveFilter(v as StatsFilter)}
        />
      </div>

      {/* Chart area */}
      <Card style={{ minHeight: 360 }}>
        {activeFilter === 'all' && (
          <Row gutter={[24, 24]}>
            <Col span={8}><Statistic title="Всего студентов" value={stats.total} /></Col>
            <Col span={8}><Statistic title="Активных" value={stats.by_status.active} valueStyle={{ color: '#3f8600' }} /></Col>
            <Col span={8}><Statistic title="Отчисленных" value={stats.by_status.expelled} valueStyle={{ color: '#cf1322' }} /></Col>
            <Col span={8}><Statistic title="Бюджет" value={stats.by_enrollment.budget} /></Col>
            <Col span={8}><Statistic title="Контракт" value={stats.by_enrollment.contract} /></Col>
            <Col span={8}><Statistic title="Очная форма" value={stats.by_study_form.full_time} /></Col>
            <Col span={8}><Statistic title="Заочная форма" value={stats.by_study_form.part_time} /></Col>
          </Row>
        )}

        {activeFilter === 'status' && (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <RechartsTooltip />
              <Bar dataKey="value" name="Студентов">
                {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {activeFilter === 'enrollment' && (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={enrollmentData} cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={5} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                {enrollmentData.map((_, i) => <Cell key={i} fill={['#1890ff', '#fadb14'][i]} />)}
              </Pie>
              <RechartsTooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}

        {activeFilter === 'study_form' && (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={studyFormData} cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={5} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                {studyFormData.map((_, i) => <Cell key={i} fill={['#52c41a', '#722ed1'][i]} />)}
              </Pie>
              <RechartsTooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}

        {activeFilter === 'course' && (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={courseData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="course" />
              <YAxis allowDecimals={false} />
              <RechartsTooltip />
              <Bar dataKey="count" name="Студентов" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        )}

        {activeFilter === 'institute' && (
          <ResponsiveContainer width="100%" height={Math.max(300, (stats.by_institute?.length ?? 1) * 50)}>
            <BarChart data={stats.by_institute} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis dataKey="institute_name" type="category" width={160} />
              <RechartsTooltip />
              <Bar dataKey="count" name="Студентов" fill="#00C49F" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
};

type FinanceFilter = 'summary' | 'by_group' | 'debtors';

// --- TAB 4 ---
const FinanceTab: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState<FinanceFilter>('summary');

  const { data: fin } = useQuery({
    queryKey: ['analytics-finance'],
    queryFn: () => apiClient.get('/analytics/payments-stats?semester=1&academicYear=2023-2024').then(res => res.data.data),
  });

  if (!fin) return null;

  const financeSegments = [
    { label: 'Сводка', value: 'summary' },
    { label: 'По группам', value: 'by_group' },
    { label: 'Должники', value: 'debtors' },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Segmented
          options={financeSegments}
          value={activeFilter}
          onChange={v => setActiveFilter(v as FinanceFilter)}
        />
      </div>

      <Card style={{ minHeight: 360 }}>
        {activeFilter === 'summary' && (
          <Row gutter={[24, 24]}>
            <Col span={12}><Statistic title="Всего к оплате" value={fin.total_due} suffix="₸" /></Col>
            <Col span={12}><Statistic title="Оплачено" value={fin.total_paid} suffix="₸" valueStyle={{ color: '#3f8600' }} /></Col>
            <Col span={12}><Statistic title="Процент оплаты" value={fin.payment_rate_percent} suffix="%" /></Col>
            <Col span={12}><Statistic title="Должников" value={fin.overdue_count} valueStyle={{ color: '#cf1322' }} /></Col>
          </Row>
        )}

        {activeFilter === 'by_group' && (
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={fin.group_stats || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="group" />
              <YAxis />
              <RechartsTooltip />
              <Legend />
              <Bar dataKey="paid" stackId="a" fill="#82ca9d" name="Оплачено" />
              <Bar dataKey="unpaid" stackId="a" fill="#ff7875" name="Долг" />
            </BarChart>
          </ResponsiveContainer>
        )}

        {activeFilter === 'debtors' && (
          <Table
            size="small"
            dataSource={fin.overdue_students || []}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            columns={[
              { title: 'ФИО', dataIndex: 'name' },
              { title: 'Группа', dataIndex: 'group' },
              { title: 'Долг', dataIndex: 'debt', render: (v: number) => <span style={{ color: 'red', fontWeight: 'bold' }}>{v.toLocaleString()} ₸</span>, sorter: (a: any, b: any) => b.debt - a.debt },
            ]}
          />
        )}
      </Card>
    </div>
  );
};
