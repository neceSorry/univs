import React, { useState } from 'react';
import { Table, Radio, Card, Typography, Tag, Empty, Spin, Select, Space } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/api.client';
import { useCurrentSemester } from '../../hooks/useCurrentSemester';

const { Title } = Typography;

const PERIODS = [
  { number: 1, time: '8:00–9:30' },
  { number: 2, time: '9:40–11:10' },
  { number: 3, time: '11:20–12:50' },
  { number: 4, time: '13:10–14:40' },
  { number: 5, time: '14:50–16:20' },
  { number: 6, time: '16:30–18:00' },
];

const DAYS = [
  { number: 1, label: 'Пн' },
  { number: 2, label: 'Вт' },
  { number: 3, label: 'Ср' },
  { number: 4, label: 'Чт' },
  { number: 5, label: 'Пт' },
  { number: 6, label: 'Сб' },
];

const TYPE_COLORS: Record<string, string> = {
  lecture: 'blue',
  practice: 'green',
  lab: 'orange',
};

const TYPE_BG: Record<string, string> = {
  lecture: 'rgba(22, 119, 255, 0.12)',
  practice: 'rgba(82, 196, 26, 0.12)',
  lab: 'rgba(250, 140, 22, 0.12)',
};

const TYPE_BORDER: Record<string, string> = {
  lecture: '#1677ff',
  practice: '#52c41a',
  lab: '#fa8c16',
};

const TYPE_LABELS: Record<string, string> = {
  lecture: 'Лек',
  practice: 'Пр',
  lab: 'Лаб',
};

const DAY_NAMES: Record<number, string> = {
  1: 'Понедельник', 2: 'Вторник', 3: 'Среда',
  4: 'Четверг', 5: 'Пятница', 6: 'Суббота',
};

const SlotCard: React.FC<{ slot: any; onClick: () => void }> = ({ slot, onClick }) => {
  const type = slot.lesson_type || 'lecture';
  return (
    <div
      onClick={onClick}
      style={{
        background: TYPE_BG[type] || '#f5f5f5',
        borderLeft: `3px solid ${TYPE_BORDER[type] || '#999'}`,
        padding: '4px 8px',
        borderRadius: 4,
        fontSize: 12,
        lineHeight: 1.5,
        cursor: 'pointer',
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
    >
      <div style={{ fontWeight: 600, color: 'rgba(255,255,255,0.88)' }}>{slot.discipline?.name}</div>
      <div style={{ color: 'rgba(255,255,255,0.55)' }}>{slot.group?.name}</div>
      <div style={{ color: 'rgba(255,255,255,0.4)' }}>{slot.classroom_text || slot.classroom?.room_number || '—'}</div>
      <Tag color={TYPE_COLORS[type] || 'blue'} style={{ fontSize: 10, marginTop: 2, padding: '0 4px' }}>
        {TYPE_LABELS[type] || 'Лек'}
      </Tag>
    </div>
  );
};

export const MySchedulePage: React.FC = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<'week' | 'list'>('week');
  const { period: defaultPeriod, academicYear: defaultYear } = useCurrentSemester();
  const [period, setPeriod] = useState<'autumn' | 'spring'>(defaultPeriod);
  const [academicYear, setAcademicYear] = useState(defaultYear);
  const [weekFilter, setWeekFilter] = useState<'all' | 'odd' | 'even'>('all');

  const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 4 }, (_, i) => {
    const y = currentYear - i;
    return `${y}-${y + 1}`;
  });

  const { data: slots = [], isLoading } = useQuery<any[]>({
    queryKey: ['teacher-my-schedule', period, academicYear],
    queryFn: () =>
      apiClient
        .get(`/teacher/my-schedule?period=${period}&academicYear=${academicYear}`)
        .then(res => res.data.data),
  });

  // Filter slots by selected week type
  const filteredSlots = slots.filter((slot: any) => {
    if (weekFilter === 'all') return true;
    return slot.week_type === 'all' || slot.week_type === weekFilter;
  });

  const grid: Record<number, Record<number, any>> = {};
  filteredSlots.forEach((slot: any) => {
    if (!grid[slot.period_number]) grid[slot.period_number] = {};
    grid[slot.period_number][slot.day_of_week] = slot;
  });

  const weekColumns = [
    {
      title: 'Время',
      key: 'time',
      width: 110,
      render: (_: any, row: any) => (
        <div style={{ fontSize: 12 }}>
          <div style={{ fontWeight: 600 }}>{row.period}-я пара</div>
          <div style={{ color: '#888' }}>{row.time}</div>
        </div>
      ),
    },
    ...DAYS.map(day => ({
      title: day.label,
      key: `day${day.number}`,
      render: (_: any, row: any) => {
        const slot = grid[row.period]?.[day.number];
        return slot ? (
          <SlotCard
            slot={slot}
            onClick={() => navigate(`/teacher/groups?groupId=${slot.group?.id}&disciplineId=${slot.discipline?.id}`)}
          />
        ) : null;
      },
    })),
  ];

  const weekData = PERIODS.map(p => ({ key: p.number, period: p.number, time: p.time }));

  const sortedSlots = [...filteredSlots].sort((a: any, b: any) =>
    a.day_of_week !== b.day_of_week
      ? a.day_of_week - b.day_of_week
      : a.period_number - b.period_number,
  );

  const listColumns = [
    {
      title: 'День',
      dataIndex: 'day_of_week',
      key: 'day',
      render: (d: number) => DAY_NAMES[d] || d,
    },
    {
      title: 'Пара',
      dataIndex: 'period_number',
      key: 'period',
      render: (n: number) => `${n}-я (${PERIODS.find(p => p.number === n)?.time || ''})`,
    },
    {
      title: 'Дисциплина',
      key: 'discipline',
      render: (_: any, r: any) => r.discipline?.name,
    },
    {
      title: 'Группа',
      key: 'group',
      render: (_: any, r: any) => r.group?.name,
    },
    {
      title: 'Аудитория',
      key: 'classroom',
      render: (_: any, r: any) => r.classroom_text || r.classroom?.room_number || '—',
    },
    {
      title: 'Тип',
      key: 'type',
      render: (_: any, r: any) => (
        <Tag color={TYPE_COLORS[r.lesson_type] || 'blue'}>
          {TYPE_LABELS[r.lesson_type] || 'Лек'}
        </Tag>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>Моё расписание</Title>
          <Space style={{ marginTop: 4 }}>
            <Select
              value={academicYear}
              onChange={setAcademicYear}
              style={{ width: 130 }}
              size="small"
              options={yearOptions.map(y => ({ value: y, label: y }))}
            />
            <Radio.Group value={period} onChange={e => setPeriod(e.target.value)} size="small">
              <Radio.Button value="autumn">Осенний</Radio.Button>
              <Radio.Button value="spring">Весенний</Radio.Button>
            </Radio.Group>
            <Radio.Group value={weekFilter} onChange={e => setWeekFilter(e.target.value)} size="small">
              <Radio.Button value="all">Все недели</Radio.Button>
              <Radio.Button value="odd">Нечётная</Radio.Button>
              <Radio.Button value="even">Чётная</Radio.Button>
            </Radio.Group>
          </Space>
        </div>
        <Radio.Group value={view} onChange={e => setView(e.target.value)}>
          <Radio.Button value="week">Сетка</Radio.Button>
          <Radio.Button value="list">Список</Radio.Button>
        </Radio.Group>
      </div>

      <Card>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
        ) : slots.length === 0 ? (
          <Empty description="Опубликованное расписание не найдено" />
        ) : view === 'week' ? (
          <Table
            columns={weekColumns}
            dataSource={weekData}
            pagination={false}
            bordered
            size="small"
          />
        ) : (
          <Table
            columns={listColumns}
            dataSource={sortedSlots}
            rowKey="id"
            pagination={false}
            onRow={(r: any) => ({
              onClick: () => navigate(`/teacher/groups?groupId=${r.group?.id}&disciplineId=${r.discipline?.id}`),
              style: { cursor: 'pointer' },
            })}
            bordered
            size="small"
          />
        )}
      </Card>
    </div>
  );
};
