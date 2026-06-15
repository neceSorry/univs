import React, { useState } from 'react';
import { Table, Button, Tabs, Badge, Tag, Space, Popconfirm, Select, message } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/api.client';
import { HierarchyFilter } from '../../components/common/HierarchyFilter';
import dayjs from 'dayjs';

export const ExamsPage: React.FC = () => {
  const [filter, setFilter] = useState<any>({});
  const [semester, setSemester] = useState<number>();
  const queryClient = useQueryClient();

  const { data: exams, isLoading } = useQuery({
    queryKey: ['exams', filter.groupId, semester],
    queryFn: () => apiClient.get(`/exams?groupId=${filter.groupId || ''}&semester=${semester || ''}`).then(res => res.data.data),
  });

  const { data: pending, isLoading: pendingLoading } = useQuery({
    queryKey: ['exams-pending'],
    queryFn: () => apiClient.get('/exams/pending').then(res => res.data.data),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/exams/${id}/approve`),
    onSuccess: () => {
      message.success('Экзамен подтверждён');
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      queryClient.invalidateQueries({ queryKey: ['exams-pending'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/exams/${id}/reject`),
    onSuccess: () => {
      message.warning('Заявка отклонена');
      queryClient.invalidateQueries({ queryKey: ['exams-pending'] });
    },
  });

  const pendingColumns = [
    { title: 'Дисциплина', dataIndex: ['discipline', 'name'], key: 'discipline' },
    { title: 'Группа', dataIndex: ['group', 'name'], key: 'group', width: 90, onCell: () => ({ style: { whiteSpace: 'nowrap' } }) },
    {
      title: 'Преподаватель',
      key: 'teacher',
      render: (r: any) => r.teacher ? `${r.teacher.last_name} ${r.teacher.first_name}` : '—',
    },
    {
      title: 'Дата и время',
      key: 'date',
      render: (r: any) => dayjs(r.exam_date).format('DD.MM.YYYY HH:mm'),
    },
    { title: 'Семестр', dataIndex: 'semester', key: 'semester', width: 80 },
    {
      title: 'Тип',
      key: 'type',
      render: (r: any) => r.type === 'exam' ? 'Экзамен' : 'Курсовая работа',
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 80,
      render: (r: any) => (
        <Space size={4}>
          <Button
            type="primary"
            shape="circle"
            size="small"
            icon={<CheckOutlined />}
            title="Подтвердить"
            onClick={() => approveMutation.mutate(r.id)}
            loading={approveMutation.isPending}
          />
          <Popconfirm title="Отклонить эту заявку?" onConfirm={() => rejectMutation.mutate(r.id)} okText="Да" cancelText="Нет">
            <Button danger shape="circle" size="small" icon={<CloseOutlined />} title="Отклонить" loading={rejectMutation.isPending} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const approvedColumns = [
    { title: 'Дисциплина', dataIndex: ['discipline', 'name'], key: 'discipline' },
    { title: 'Группа', dataIndex: ['group', 'name'], key: 'group' },
    {
      title: 'Преподаватель',
      key: 'teacher',
      render: (r: any) => r.teacher ? `${r.teacher.last_name} ${r.teacher.first_name}` : '—',
    },
    {
      title: 'Дата и время',
      key: 'date',
      render: (r: any) => dayjs(r.exam_date).format('DD.MM.YYYY HH:mm'),
    },
    {
      title: 'Аудитория',
      key: 'classroom',
      render: (r: any) => r.classroom_text || r.classroom?.room_number || '—',
    },
    {
      title: 'Тип',
      key: 'type',
      render: (r: any) => r.type === 'exam' ? 'Экзамен' : 'Курсовая работа',
    },
    {
      title: 'Статус',
      key: 'status',
      render: (r: any) => (
        <Tag color={dayjs(r.exam_date).isBefore(dayjs()) ? 'green' : 'blue'}>
          {dayjs(r.exam_date).isBefore(dayjs()) ? 'Прошёл' : 'Запланирован'}
        </Tag>
      ),
    },
  ];

  const pendingCount = pending?.length ?? 0;

  const tabItems = [
    {
      key: 'pending',
      label: (
        <Badge count={pendingCount} offset={[8, 0]}>
          <span style={{ paddingRight: pendingCount > 0 ? 14 : 0 }}>Заявки</span>
        </Badge>
      ),
      children: (
        <Table
          columns={pendingColumns}
          dataSource={pending || []}
          rowKey="id"
          loading={pendingLoading}
          pagination={false}
          locale={{ emptyText: 'Новых заявок нет' }}
        />
      ),
    },
    {
      key: 'approved',
      label: 'Расписание экзаменов',
      children: (
        <>
          <Space style={{ marginBottom: 16, alignItems: 'flex-start' }}>
            <HierarchyFilter levels={['institute', 'department', 'program', 'group']} onChange={setFilter} />
            <Select
              style={{ width: 120 }}
              placeholder="Семестр"
              options={[1, 2, 3, 4, 5, 6, 7, 8].map(s => ({ label: `${s} сем`, value: s }))}
              onChange={setSemester}
              allowClear
            />
          </Space>
          <Table
            columns={approvedColumns}
            dataSource={exams || []}
            rowKey="id"
            loading={isLoading}
            pagination={false}
            locale={{ emptyText: 'Нет данных' }}
          />
        </>
      ),
    },
  ];

  return (
    <div>
      <h2>Экзамены (Админ)</h2>
      <Tabs defaultActiveKey="pending" items={tabItems} />
    </div>
  );
};
