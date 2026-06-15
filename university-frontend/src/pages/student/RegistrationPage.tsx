import React from 'react';
import { Card, Button, Table, Typography, message } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/api.client';

const { Title } = Typography;

export const RegistrationPage: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: disciplines, isLoading } = useQuery({
    queryKey: ['available-disciplines'],
    queryFn: () => apiClient.get('/student/available-disciplines').then(res => res.data.data),
  });

  const registerMutation = useMutation({
    mutationFn: (id: string) => apiClient.post('/student/register-discipline', { disciplineId: id }),
    onSuccess: () => {
      message.success('Вы успешно записались на дисциплину');
      queryClient.invalidateQueries({ queryKey: ['available-disciplines'] });
    },
  });

  const columns = [
    { title: 'Дисциплина', dataIndex: 'name', key: 'name' },
    { title: 'Лекции (ч)', dataIndex: 'hours_lecture', key: 'hours_lecture', width: 110 },
    { title: 'Практики (ч)', dataIndex: 'hours_practice', key: 'hours_practice', width: 120 },
    { title: 'Лабы (ч)', dataIndex: 'hours_lab', key: 'hours_lab', width: 100 },
    { title: 'Кредиты', dataIndex: 'credits', key: 'credits', width: 90 },
    {
      title: '',
      key: 'action',
      width: 130,
      render: (_: any, r: any) => (
        <Button
          type="primary"
          size="small"
          loading={registerMutation.isPending}
          onClick={() => registerMutation.mutate(r.id)}
        >
          Записаться
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Title level={2}>Регистрация на дисциплины</Title>
      <Card>
        <Table
          columns={columns}
          dataSource={disciplines ?? []}
          rowKey="id"
          loading={isLoading}
          pagination={false}
          locale={{ emptyText: 'Все дисциплины пройдены или нет доступных элективов' }}
        />
      </Card>
    </div>
  );
};
