import React from 'react';
import { Row, Col, Card, Typography, Avatar, Progress, Alert, Table, Statistic, Tag, Descriptions } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/api.client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const { Title, Text } = Typography;

const ENROLLMENT_LABELS: Record<string, string> = {
  budget: 'Бюджет',
  contract: 'Контракт',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: 'Активен', color: 'green' },
  expelled: { label: 'Отчислен', color: 'red' },
  academic_leave: { label: 'Академический отпуск', color: 'orange' },
};

export const StudentProfilePage: React.FC = () => {
  const { data: infoData, isLoading: infoLoading } = useQuery({
    queryKey: ['my-info'],
    queryFn: () => apiClient.get('/student/my-info').then(res => res.data.data),
  });

  const { data: gpaData } = useQuery({
    queryKey: ['my-gpa'],
    queryFn: () => apiClient.get('/student/my-gpa').then(res => res.data.data),
  });

  const { data: payment } = useQuery({
    queryKey: ['my-payment'],
    queryFn: () => apiClient.get('/student/my-payment').then(res => res.data.data),
    enabled: infoData?.enrollment_type === 'contract',
  });

  const { data: orders } = useQuery({
    queryKey: ['my-orders'],
    queryFn: () => apiClient.get('/student/my-orders').then(res => res.data.data),
  });

  const info = infoData ?? {};
  const fullName = [info.last_name, info.first_name, info.middle_name].filter(Boolean).join(' ') || '—';
  const statusInfo = STATUS_LABELS[info.status] ?? { label: info.status, color: 'default' };

  return (
    <div>
      <Title level={2}>Личный кабинет</Title>

      <Row gutter={[16, 16]}>
        {/* Блок 1: Личные данные */}
        <Col xs={24} sm={24} md={8}>
          <Card loading={infoLoading}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <Avatar size={88} icon={<UserOutlined />} />
              <Title level={4} style={{ marginTop: 12, marginBottom: 4 }}>{fullName}</Title>
              <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
            </div>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Группа">{info.group_name ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Направление">{info.program_name ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Курс">{info.course != null ? `${info.course} курс` : '—'}</Descriptions.Item>
              <Descriptions.Item label="Год поступления">{info.year_of_entry ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Форма обучения">
                {info.enrollment_type ? (
                  <Tag color={info.enrollment_type === 'budget' ? 'blue' : 'gold'}>
                    {ENROLLMENT_LABELS[info.enrollment_type]}
                  </Tag>
                ) : '—'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {/* Блок 2: Успеваемость (GPA) */}
        <Col xs={24} sm={24} md={16}>
          <Card title="Успеваемость">
            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Statistic
                  title="Текущий GPA"
                  value={gpaData?.currentGpa ?? '—'}
                  precision={2}
                  styles={{ content: { color: '#3f8600', fontSize: 36 } }}
                />
                <div style={{ marginTop: 12 }}>
                  <Text type="secondary">
                    {gpaData?.rankGroup != null
                      ? `${gpaData.rankGroup} место в группе`
                      : '—'}
                  </Text>
                  <br />
                  <Text type="secondary">
                    {gpaData?.rankCourse != null
                      ? `${gpaData.rankCourse} место на курсе`
                      : ''}
                  </Text>
                </div>
              </Col>
              <Col xs={24} sm={16} style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={gpaData?.history ?? []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="semester" tickFormatter={s => `${s} сем`} />
                    <YAxis domain={[0, 4]} />
                    <Tooltip formatter={(v) => typeof v === 'number' ? v.toFixed(2) : v} />
                    <Line type="monotone" dataKey="gpa" stroke="#1677ff" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Блок 3: Оплата (только для контрактников) */}
        {info.enrollment_type === 'contract' && (
          <Col xs={24} sm={24} md={12}>
            <Card title="Оплата обучения">
              {payment ? (
                <div>
                  {payment.status === 'overdue' && (
                    <Alert
                      message="Нет допуска к экзаменам"
                      description="Имеется задолженность по оплате. Погасите долг для получения допуска."
                      type="error"
                      showIcon
                      style={{ marginBottom: 16 }}
                    />
                  )}
                  <Progress
                    percent={Math.min(100, Math.round((payment.amount_paid / payment.amount_due) * 100))}
                    status={payment.status === 'overdue' ? 'exception' : payment.amount_paid >= payment.amount_due ? 'success' : 'active'}
                    strokeColor={payment.status === 'overdue' ? '#ff4d4f' : undefined}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                    <Text>Оплачено: <strong>{payment.amount_paid?.toLocaleString()} сом</strong></Text>
                    <Text>К оплате: <strong>{payment.amount_due?.toLocaleString()} сом</strong></Text>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Tag color={payment.status === 'paid' ? 'green' : payment.status === 'overdue' ? 'red' : 'orange'}>
                      {payment.status === 'paid' ? 'Оплачено' : payment.status === 'overdue' ? 'Просрочено' : 'Частично оплачено'}
                    </Tag>
                  </div>
                </div>
              ) : (
                <Text type="secondary">Нет данных об оплате</Text>
              )}
            </Card>
          </Col>
        )}

        {/* Блок 4: Приказы */}
        <Col xs={24} sm={24} md={info.enrollment_type === 'contract' ? 12 : 24}>
          <Card title="Приказы">
            <Table
              size="small"
              pagination={false}
              dataSource={orders ?? []}
              rowKey="id"
              locale={{ emptyText: 'Приказов нет' }}
              columns={[
                { title: 'Дата', dataIndex: 'date', key: 'date' },
                { title: 'Номер', dataIndex: 'number', key: 'number' },
                { title: 'Тип', dataIndex: 'type', key: 'type' },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};
