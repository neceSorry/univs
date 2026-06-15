import React from 'react';
import { Card, Table, Tag, Typography, Alert } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/api.client';

const { Title } = Typography;

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  upcoming: { label: 'Предстоит', color: 'blue' },
  approved: { label: 'Подтверждён', color: 'green' },
  passed: { label: 'Сдан', color: 'green' },
  failed: { label: 'Не сдан', color: 'red' },
};

export const StudentExamsPage: React.FC = () => {
  const { data: exams, isLoading } = useQuery({
    queryKey: ['my-exams'],
    queryFn: () => apiClient.get('/student/my-exams').then(res => res.data.data),
  });

  const { data: payment } = useQuery({
    queryKey: ['my-payment'],
    queryFn: () => apiClient.get('/student/my-payment').then(res => res.data.data),
  });

  const columns = [
    { title: 'Дисциплина', dataIndex: ['discipline', 'name'], key: 'discipline', render: (v: string) => v ?? '—' },
    {
      title: 'Дата и время',
      key: 'datetime',
      render: (_: unknown, r: any) => {
        const raw = r.exam_date ?? r.exam_time;
        if (!raw) return '—';
        const d = new Date(raw);
        if (isNaN(d.getTime())) return String(raw);
        const date = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        return `${date}, ${time}`;
      },
    },
    { title: 'Аудитория', dataIndex: 'classroom_text', key: 'classroom', render: (v: string) => v ?? '—' },
    {
      title: 'Преподаватель',
      key: 'teacher',
      render: (_: unknown, r: any) =>
        r.teacher ? `${r.teacher.last_name} ${r.teacher.first_name}` : '—',
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => {
        const info = STATUS_MAP[s] ?? { label: s ?? 'Предстоит', color: 'default' };
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
  ];

  return (
    <div>
      <Title level={2}>Экзамены</Title>

      {payment?.status === 'overdue' && (
        <Alert
          message="Нет допуска к экзаменам"
          description="Имеется задолженность по оплате. Погасите долг для получения допуска к сессии."
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Card>
        <Table
          columns={columns}
          dataSource={exams ?? []}
          rowKey="id"
          loading={isLoading}
          pagination={false}
          locale={{ emptyText: 'Экзаменов пока нет' }}
        />
      </Card>
    </div>
  );
};
