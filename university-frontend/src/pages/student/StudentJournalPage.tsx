import React, { useMemo } from 'react';
import { Table, Typography, Spin, Empty, Tag } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/api.client';

const { Title } = Typography;

export const StudentJournalPage: React.FC = () => {
  const { data: journalData, isLoading: loadingJournal } = useQuery({
    queryKey: ['student-my-journal'],
    queryFn: () => apiClient.get('/student/my-journal').then(r => r.data.data ?? []),
  });

  const { data: disciplines } = useQuery({
    queryKey: ['student-disciplines-list'],
    queryFn: () => apiClient.get('/student/my-curriculum').then(r => r.data.data ?? []),
  });

  const disciplineMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const d of disciplines ?? []) {
      map[d.discipline?.id ?? d.id] = d.discipline?.name ?? d.name ?? '—';
    }
    return map;
  }, [disciplines]);

  // Collect all unique dates across all disciplines
  const allDates = useMemo(() => {
    const set = new Set<string>();
    for (const row of journalData ?? []) {
      for (const e of row.entries ?? []) {
        if (e.lesson_date) set.add(e.lesson_date);
      }
    }
    return [...set].sort();
  }, [journalData]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  };

  const dataSource = useMemo(() => {
    return (journalData ?? []).map((row: any) => {
      const dateMap: Record<string, string> = {};
      let finalVal = '';
      for (const e of row.entries ?? []) {
        if (e.lesson_date === null) finalVal = e.value;
        else dateMap[e.lesson_date] = e.value;
      }
      return { discipline_id: row.discipline_id, dateMap, finalVal };
    });
  }, [journalData]);

  if (loadingJournal) return <Spin style={{ display: 'block', marginTop: 48 }} />;
  if (!dataSource.length) return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>Журнал отметок</Title>
      <Empty description="Нет данных" image={Empty.PRESENTED_IMAGE_SIMPLE} />
    </div>
  );

  const dateColumns = allDates.map(iso => ({
    title: <span style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{formatDate(iso)}</span>,
    key: iso,
    width: 52,
    align: 'center' as const,
    render: (_: any, r: any) => {
      const v = r.dateMap[iso] ?? '';
      if (!v) return <span style={{ color: 'rgba(128,128,128,0.4)' }}>·</span>;
      return (
        <Tag
          color={v === '+' ? 'green' : 'blue'}
          style={{ margin: 0, minWidth: 28, textAlign: 'center' }}
        >
          {v}
        </Tag>
      );
    },
  }));

  const columns = [
    {
      title: 'Дисциплина',
      key: 'discipline',
      fixed: 'left' as const,
      width: 220,
      render: (_: any, r: any) => disciplineMap[r.discipline_id] ?? r.discipline_id,
    },
    ...dateColumns,
    {
      title: 'Итог. балл',
      key: 'final',
      width: 100,
      align: 'center' as const,
      fixed: 'right' as const,
      render: (_: any, r: any) => r.finalVal
        ? <Tag color="purple" style={{ margin: 0 }}>{r.finalVal}</Tag>
        : <span style={{ color: 'rgba(128,128,128,0.4)' }}>—</span>,
    },
  ];

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>Журнал отметок</Title>
      <Table
        columns={columns}
        dataSource={dataSource}
        rowKey="discipline_id"
        pagination={false}
        bordered
        size="small"
        scroll={{ x: 'max-content' }}
      />
    </div>
  );
};
