import React, { useState, useEffect } from 'react';
import { Radio, Tag, Typography, Alert, Spin, Table, theme, Select, Space } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/api.client';
import { useCurrentSemester } from '../../hooks/useCurrentSemester';

const { Title } = Typography;

const PERIODS = [
  { num: 1, time: '08:00 – 09:35' },
  { num: 2, time: '09:45 – 11:20' },
  { num: 3, time: '11:30 – 13:05' },
  { num: 4, time: '13:50 – 15:25' },
  { num: 5, time: '15:35 – 17:10' },
  { num: 6, time: '17:20 – 18:55' },
];

const DAYS = [
  { num: 1, label: 'Пн' },
  { num: 2, label: 'Вт' },
  { num: 3, label: 'Ср' },
  { num: 4, label: 'Чт' },
  { num: 5, label: 'Пт' },
  { num: 6, label: 'Сб' },
];

const LESSON_LABELS: Record<string, string> = {
  lecture: 'Лек.',
  practice: 'Пр.',
  lab: 'Лаб.',
};

const LESSON_TAG_COLORS: Record<string, string> = {
  lecture: 'blue',
  practice: 'green',
  lab: 'orange',
};

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function useCurrentWeekType(): 'odd' | 'even' {
  const week = getISOWeekNumber(new Date());
  return week % 2 === 0 ? 'even' : 'odd';
}

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return mobile;
}

interface Slot {
  id: string;
  day_of_week: number;
  period_number: number;
  week_type: 'all' | 'odd' | 'even';
  lesson_type: string;
  classroom_text?: string;
  discipline?: { name: string };
  teacher?: { first_name: string; last_name: string };
}

const LessonCard: React.FC<{ slot: Slot }> = ({ slot }) => {
  const { token } = theme.useToken();
  const typeLabel = LESSON_LABELS[slot.lesson_type] ?? '';
  const tagColor = LESSON_TAG_COLORS[slot.lesson_type] ?? 'blue';
  const teacherName = slot.teacher
    ? `${slot.teacher.last_name} ${slot.teacher.first_name.charAt(0)}.`
    : '';

  return (
    <div
      style={{
        padding: '4px 8px',
        background: token.colorFillAlter,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 4,
        fontSize: 12,
        userSelect: 'none',
        marginBottom: 4,
      }}
    >
      <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {slot.discipline?.name ?? '—'}
      </div>
      <div style={{ color: token.colorTextSecondary, fontSize: 11 }}>
        {typeLabel && (
          <Tag color={tagColor} style={{ fontSize: 10, marginRight: 4, padding: '0 4px', lineHeight: '16px' }}>
            {typeLabel}
          </Tag>
        )}
        {teacherName}
      </div>
      {slot.classroom_text && (
        <div style={{ color: token.colorTextTertiary, fontSize: 11 }}>Ауд: {slot.classroom_text}</div>
      )}
      {slot.week_type !== 'all' && (
        <span style={{ fontSize: 10, color: token.colorPrimary, fontWeight: 500 }}>
          {slot.week_type === 'odd' ? 'Нечет.' : 'Чет.'}
        </span>
      )}
    </div>
  );
};

export const StudentSchedulePage: React.FC = () => {
  const { token } = theme.useToken();
  const currentWeekType = useCurrentWeekType();
  const { period: defaultPeriod, academicYear: defaultYear } = useCurrentSemester();
  const [weekFilter, setWeekFilter] = useState<'all' | 'odd' | 'even'>(currentWeekType);
  const [period, setPeriod] = useState<'autumn' | 'spring'>(defaultPeriod);
  const [academicYear, setAcademicYear] = useState(defaultYear);
  const isMobile = useIsMobile();

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 4 }, (_, i) => {
    const y = currentYear - i;
    return { label: `${y}-${y + 1}`, value: `${y}-${y + 1}` };
  });

  const { data, isLoading } = useQuery({
    queryKey: ['my-schedule', period, academicYear],
    queryFn: () => apiClient.get(`/student/my-schedule?period=${period}&academicYear=${academicYear}`).then(res => res.data),
  });

  const slots: Slot[] = data?.data ?? [];
  const isPublished: boolean = data?.published ?? false;

  const filteredSlots = slots.filter(s =>
    s.week_type === 'all' || s.week_type === weekFilter,
  );

  const getSlotsForCell = (day: number, period: number): Slot[] =>
    filteredSlots.filter(s => s.day_of_week === day && s.period_number === period);

  if (isLoading) return <Spin style={{ display: 'block', marginTop: 48 }} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Title level={2} style={{ margin: 0 }}>Расписание занятий</Title>
        <Space wrap>
          <Select
            value={academicYear}
            onChange={setAcademicYear}
            options={yearOptions}
            style={{ width: 120 }}
          />
          <Radio.Group value={period} onChange={e => setPeriod(e.target.value)} buttonStyle="solid">
            <Radio.Button value="autumn">Осень</Radio.Button>
            <Radio.Button value="spring">Весна</Radio.Button>
          </Radio.Group>
          <Radio.Group value={weekFilter} onChange={e => setWeekFilter(e.target.value)} buttonStyle="solid">
            <Radio.Button value="odd">Нечётная</Radio.Button>
            <Radio.Button value="even">Чётная</Radio.Button>
            <Radio.Button value="all">Все</Radio.Button>
          </Radio.Group>
        </Space>
      </div>

      {!isPublished && (
        <Alert
          message="Расписание ещё не опубликовано"
          description="Как только администратор опубликует расписание — оно появится здесь."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {isPublished && isMobile ? (
        <MobileList slots={filteredSlots} />
      ) : isPublished ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ border: `1px solid ${token.colorBorderSecondary}`, padding: 8, background: token.colorFillAlter, width: 72, textAlign: 'center' }}>
                  Пара
                </th>
                {DAYS.map(d => (
                  <th key={d.num} style={{ border: `1px solid ${token.colorBorderSecondary}`, padding: 8, background: token.colorFillAlter, textAlign: 'center' }}>
                    {d.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map(p => (
                <tr key={p.num}>
                  <td style={{ border: `1px solid ${token.colorBorderSecondary}`, padding: '6px 4px', textAlign: 'center', background: token.colorFillAlter, width: 72 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{p.num}</div>
                    <div style={{ fontSize: 10, color: token.colorTextDisabled }}>{p.time}</div>
                  </td>
                  {DAYS.map(d => {
                    const cellSlots = getSlotsForCell(d.num, p.num);
                    return (
                      <td
                        key={d.num}
                        style={{
                          border: `1px solid ${token.colorBorderSecondary}`,
                          padding: '4px 6px',
                          verticalAlign: 'top',
                          minHeight: 88,
                          width: '16%',
                        }}
                      >
                        {cellSlots.length === 0 ? (
                          <div style={{ minHeight: 60, color: token.colorTextDisabled, textAlign: 'center', paddingTop: 22, fontSize: 11 }}>—</div>
                        ) : (
                          cellSlots.map(slot => <LessonCard key={slot.id} slot={slot} />)
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
};

const MobileList: React.FC<{ slots: Slot[] }> = ({ slots }) => {
  const sorted = [...slots].sort((a, b) =>
    a.day_of_week !== b.day_of_week ? a.day_of_week - b.day_of_week : a.period_number - b.period_number,
  );

  const columns = [
    {
      title: 'День / Пара',
      key: 'time',
      render: (_: unknown, s: Slot) => (
        <div>
          <div style={{ fontWeight: 600 }}>{DAYS.find(d => d.num === s.day_of_week)?.label}</div>
          <div style={{ fontSize: 12, color: '#888' }}>{PERIODS.find(p => p.num === s.period_number)?.time}</div>
        </div>
      ),
    },
    {
      title: 'Занятие',
      key: 'lesson',
      render: (_: unknown, s: Slot) => {
        const tagColor = LESSON_TAG_COLORS[s.lesson_type] ?? 'blue';
        const label = LESSON_LABELS[s.lesson_type] ?? s.lesson_type;
        return (
          <div>
            <Tag color={tagColor}>{label}</Tag>
            <div style={{ fontWeight: 600 }}>{s.discipline?.name ?? '—'}</div>
            {s.teacher && (
              <div style={{ fontSize: 12, color: '#888' }}>
                {s.teacher.last_name} {s.teacher.first_name}
              </div>
            )}
            {s.classroom_text && <div style={{ fontSize: 12, color: '#888' }}>{s.classroom_text}</div>}
          </div>
        );
      },
    },
  ];

  return <Table columns={columns} dataSource={sorted} rowKey="id" pagination={false} size="small" />;
};
