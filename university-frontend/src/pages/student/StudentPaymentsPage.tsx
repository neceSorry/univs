import React, { useState } from 'react';
import {
  Card, Table, Tag, Button, Modal, Form, InputNumber, Input,
  message, Alert, Typography, Space, Divider, Row, Col,
} from 'antd';
import {
  CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/api.client';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Ожидает оплаты', color: 'default', icon: <ClockCircleOutlined /> },
  partial: { label: 'Частично оплачено', color: 'orange', icon: <ExclamationCircleOutlined /> },
  paid:    { label: 'Оплачено', color: 'green', icon: <CheckCircleOutlined /> },
  overdue: { label: 'Просрочено', color: 'red', icon: <ExclamationCircleOutlined /> },
};

const SERVICE_LABEL: Record<string, string> = {
  tuition:          'Плата за обучение',
  summer_semester:  'Плата за летний семестр',
  dormitory:        'Плата за общежитие',
  grade_sheet:      'Плата за зачетно-экз. ведомость',
  diploma:          'Оплата за корочку диплома',
  document_intake:  'Оплата за прием документов',
  transfer:         'Оплата за перевод или восстановление',
};

// University bank requisites — shown to student for manual transfer
const REQUISITES = [
  { label: 'Получатель', value: 'Университет' },
  { label: 'Расчётный счёт', value: '1280130104650100' },
];

export const StudentPaymentsPage: React.FC = () => {
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: payments, isLoading } = useQuery({
    queryKey: ['student-my-payments'],
    queryFn: () => apiClient.get('/student/my-payments').then(r => r.data.data),
  });

  const submitMutation = useMutation({
    mutationFn: (values: any) =>
      apiClient.put(`/student/payments/${selectedPayment.id}/submit`, values),
    onSuccess: () => {
      message.success('Оплата зарегистрирована');
      setSelectedPayment(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['student-my-payments'] });
    },
    onError: () => message.error('Ошибка при регистрации оплаты'),
  });

const columns = [
    {
      title: 'Вид услуги',
      dataIndex: 'service_type',
      key: 'service_type',
      render: (v: string) => SERVICE_LABEL[v] ?? v,
    },
    {
      title: 'Семестр',
      dataIndex: 'semester',
      key: 'semester',
      render: (v: number) => `${v} сем.`,
    },
    {
      title: 'Учебный год',
      dataIndex: 'academic_year',
      key: 'academic_year',
    },
    {
      title: 'К оплате',
      dataIndex: 'amount_due',
      key: 'due',
      render: (v: number) => <Text strong>{Number(v).toLocaleString()} сом</Text>,
    },
    {
      title: 'Оплачено',
      dataIndex: 'amount_paid',
      key: 'paid',
      render: (v: number) => `${Number(v).toLocaleString()} сом`,
    },
    {
      title: 'Остаток',
      key: 'remainder',
      render: (_: unknown, r: any) => {
        const rem = Number(r.amount_due) - Number(r.amount_paid);
        return rem > 0 ? <Text type="danger">{rem.toLocaleString()} сом</Text> : <Text type="success">—</Text>;
      },
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => {
        const info = STATUS_MAP[s] ?? { label: s, color: 'default', icon: null };
        return <Tag color={info.color} icon={info.icon}>{info.label}</Tag>;
      },
    },
    {
      title: 'Срок',
      dataIndex: 'due_date',
      key: 'due_date',
      render: (v: string) => v ? dayjs(v).format('DD.MM.YYYY') : '—',
    },
    {
      title: 'Квитанция',
      dataIndex: 'receipt_number',
      key: 'receipt',
      render: (v: string) => v ? <Text code>{v}</Text> : '—',
    },
    {
      title: '',
      key: 'actions',
      render: (_: unknown, r: any) =>
        r.status !== 'paid' ? (
          <Button
            type="primary"
            size="small"
            onClick={() => { setSelectedPayment(r); form.resetFields(); }}
          >
            Оплатить
          </Button>
        ) : null,
    },
  ];

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>Мои оплаты</Title>

      {/* Invoices table */}
      <Card title="Мои счета">
        <Table
          columns={columns}
          dataSource={payments ?? []}
          rowKey="id"
          loading={isLoading}
          pagination={false}
          locale={{ emptyText: 'Счетов не найдено' }}
          scroll={{ x: 900 }}
          rowClassName={(r: any) => r.status === 'overdue' ? 'overdue-row' : ''}
        />
        <style>{`.overdue-row > td { background-color: #fff1f0 !important; }`}</style>
      </Card>

      {/* Payment submission modal */}
      <Modal
        title={selectedPayment ? `Подтвердить оплату — ${SERVICE_LABEL[selectedPayment.service_type] ?? ''}` : ''}
        open={!!selectedPayment}
        onCancel={() => { setSelectedPayment(null); form.resetFields(); }}
        onOk={() => form.submit()}
        okText="Подтвердить оплату"
        confirmLoading={submitMutation.isPending}
        destroyOnHidden
      >
        {selectedPayment && (
          <>
            <Divider style={{ marginTop: 0 }}>Реквизиты для оплаты</Divider>
            <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
              {REQUISITES.map(r => (
                <Col xs={24} sm={12} key={r.label}>
                  <Space size={4}>
                    <Text type="secondary">{r.label}:</Text>
                    <Text copyable strong>{r.value}</Text>
                  </Space>
                </Col>
              ))}
            </Row>
            <Divider style={{ margin: '12px 0' }} />
            <Alert
              type="info"
              style={{ marginBottom: 16 }}
              message={
                <>
                  К оплате: <strong>{Number(selectedPayment.amount_due).toLocaleString()} сом</strong>
                  {Number(selectedPayment.amount_paid) > 0 && (
                    <> · Уже оплачено: <strong>{Number(selectedPayment.amount_paid).toLocaleString()} сом</strong></>
                  )}
                  {' · '}
                  Остаток: <strong>{(Number(selectedPayment.amount_due) - Number(selectedPayment.amount_paid)).toLocaleString()} сом</strong>
                </>
              }
            />
            <Form form={form} layout="vertical" onFinish={(vals) => submitMutation.mutate(vals)}>
              <Form.Item
                name="amount_paid"
                label="Сумма оплаты (сом)"
                rules={[{ required: true, message: 'Введите сумму' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={1}
                  max={Number(selectedPayment.amount_due) - Number(selectedPayment.amount_paid)}
                  placeholder={`Макс. ${(Number(selectedPayment.amount_due) - Number(selectedPayment.amount_paid)).toLocaleString()} сом`}
                />
              </Form.Item>
              <Form.Item
                name="receipt_number"
                label="Номер квитанции / чека"
                rules={[{ required: true, message: 'Введите номер квитанции' }]}
              >
                <Input placeholder="например 201210863103" />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </div>
  );
};
