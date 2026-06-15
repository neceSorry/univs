import React, { useState } from 'react';
import {
  Table, Button, Modal, Form, Select, InputNumber, Input,
  message, Space, Tag, Alert, DatePicker, Radio, Popconfirm,
} from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/api.client';
import { HierarchyFilter } from '../../components/common/HierarchyFilter';
import dayjs from 'dayjs';


const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: 'Не оплачено', color: 'default' },
  partial: { label: 'Оплачено частично', color: 'orange' },
  paid:    { label: 'Оплачено', color: 'green' },
  overdue: { label: 'Просрочено', color: 'red' },
};

const SERVICE_TYPE_OPTIONS = [
  { value: 'tuition',          label: 'Плата за обучение' },
  { value: 'summer_semester',  label: 'Плата за летний семестр' },
  { value: 'dormitory',        label: 'Плата за общежитие' },
  { value: 'grade_sheet',      label: 'Плата за зачетно-экз. ведомость' },
  { value: 'diploma',          label: 'Оплата за корочку диплома' },
  { value: 'document_intake',  label: 'Оплата за прием документов' },
  { value: 'transfer',         label: 'Оплата за перевод или восстановление' },
];


const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];
const YEARS = ['2021-2022', '2022-2023', '2023-2024', '2024-2025', '2025-2026', '2026-2027', '2027-2028', '2028-2029'];

function deriveAcademicYear(yearOfEntry: number, semester: number): string {
  const course = Math.ceil(semester / 2);
  const startYear = yearOfEntry + course - 1;
  return `${startYear}-${startYear + 1}`;
}

export const PaymentsPage: React.FC = () => {
  const [groupId, setGroupId] = useState<string | undefined>();
  const [semester, setSemester] = useState<number | undefined>();
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string | undefined>();
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [generateTarget, setGenerateTarget] = useState<'group' | 'student'>('group');
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [form] = Form.useForm();
  const [payForm] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: allGroups } = useQuery({
    queryKey: ['all-groups'],
    queryFn: () => apiClient.get('/groups').then(r => r.data.data),
  });

  const { data: allStudents } = useQuery({
    queryKey: ['all-students'],
    queryFn: () => apiClient.get('/students').then(r => r.data.data),
    enabled: isGenerateOpen && generateTarget === 'student',
  });

  const { data: payments, isLoading } = useQuery({
    queryKey: ['payments', groupId, semester, serviceTypeFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (groupId) params.set('groupId', groupId);
      if (semester) params.set('semester', String(semester));
      if (serviceTypeFilter) params.set('serviceType', serviceTypeFilter);
      return apiClient.get(`/payments?${params}`).then(r => r.data.data);
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['payments'] });
  };

  const generateMutation = useMutation({
    mutationFn: (values: any) => apiClient.post('/payments/generate', {
      ...values,
      due_date: values.due_date ? values.due_date.toISOString() : null,
    }),
    onSuccess: (res) => {
      const count = res.data?.data?.count ?? 0;
      message.success(`Сгенерировано счетов: ${count} (только контрактники)`);
      setIsGenerateOpen(false);
      form.resetFields();
      invalidateAll();
    },
    onError: () => message.error('Ошибка при генерации счетов'),
  });

  const payMutation = useMutation({
    mutationFn: (values: any) =>
      apiClient.put(`/payments/${selectedPayment.id}/pay`, values),
    onSuccess: () => {
      message.success('Оплата зачислена');
      setSelectedPayment(null);
      payForm.resetFields();
      invalidateAll();
    },
    onError: () => message.error('Ошибка при зачислении оплаты'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/payments/${id}`),
    onSuccess: () => { message.success('Счёт удалён'); setDeletingId(null); invalidateAll(); },
    onError: () => { message.error('Ошибка при удалении счёта'); setDeletingId(null); },
  });

  const columns = [
    {
      title: 'Студент',
      render: (_: unknown, r: any) =>
        `${r.student?.last_name ?? ''} ${r.student?.first_name ?? ''}`.trim() || '—',
    },
    { title: 'Группа', dataIndex: ['student', 'group', 'name'], key: 'group' },
    {
      title: 'К оплате',
      dataIndex: 'amount_due',
      key: 'due',
      render: (v: number) => `${Number(v).toLocaleString()} сом`,
    },
    {
      title: 'Оплачено',
      dataIndex: 'amount_paid',
      key: 'paid',
      render: (v: number) => `${Number(v).toLocaleString()} сом`,
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => {
        const info = STATUS_MAP[s] ?? { label: s, color: 'default' };
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: 'Квитанция',
      dataIndex: 'receipt_number',
      key: 'receipt',
      render: (v: string) => v ?? '—',
    },
    {
      title: 'Дата оплаты',
      dataIndex: 'paid_at',
      key: 'paid_at',
      render: (v: string) => v ? dayjs(v).format('DD.MM.YYYY HH:mm') : '—',
    },
    {
      title: 'Действия',
      key: 'actions',
      render: (_: unknown, r: any) => (
        <Popconfirm
          title="Удалить счёт?"
          okText="Да"
          cancelText="Нет"
          onConfirm={() => { setDeletingId(r.id); deleteMutation.mutate(r.id); }}
        >
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            loading={deletingId === r.id}
          />
        </Popconfirm>
      ),
    },
  ];


  const invoicesTab = (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <HierarchyFilter
          levels={['institute', 'department', 'program', 'group']}
          onChange={(sel) => setGroupId(sel.groupId)}
        />
        <Select
          style={{ width: 120 }}
          placeholder="Семестр"
          allowClear
          options={SEMESTERS.map(s => ({ label: `${s} семестр`, value: s }))}
          onChange={setSemester}
        />
      </div>
      <Space wrap align="center" style={{ marginBottom: 12 }}>
        <Select
          style={{ width: 260 }}
          placeholder="Все виды услуг"
          allowClear
          options={SERVICE_TYPE_OPTIONS}
          onChange={setServiceTypeFilter}
        />
        <Button type="primary" onClick={() => setIsGenerateOpen(true)}>
          Новый счёт
        </Button>
      </Space>

      <style>{`.overdue-row > td { background-color: #fff1f0 !important; }`}</style>

      <Table
        columns={columns}
        dataSource={payments ?? []}
        rowKey="id"
        loading={isLoading}
        pagination={false}
        rowClassName={(r: any) => (r.status === 'overdue' ? 'overdue-row' : '')}
        locale={{ emptyText: 'Счетов не найдено' }}
        scroll={{ x: 1200 }}
      />
    </div>
  );

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>Финансы / Оплаты</h2>

      {invoicesTab}

      {/* ─── Generate invoices modal ─── */}
      <Modal
        title="Новый счёт"
        open={isGenerateOpen}
        onCancel={() => { setIsGenerateOpen(false); form.resetFields(); setGenerateTarget('group'); }}
        onOk={() => form.submit()}
        confirmLoading={generateMutation.isPending}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(vals) => generateMutation.mutate(vals)}
          onValuesChange={(_changed, all) => {
            const { semester: sem, group_id, student_id } = all;
            if (!sem) return;
            let yearOfEntry: number | undefined;
            if (generateTarget === 'group' && group_id) {
              yearOfEntry = allGroups?.find((g: any) => g.id === group_id)?.year_of_entry;
            } else if (generateTarget === 'student' && student_id) {
              yearOfEntry = allStudents?.find((s: any) => s.id === student_id)?.group?.year_of_entry;
            }
            if (yearOfEntry) {
              form.setFieldValue('academic_year', deriveAcademicYear(yearOfEntry, sem));
            }
          }}
        >
          {/* Target selector */}
          <Form.Item label="Выставить счёт для">
            <Radio.Group
              value={generateTarget}
              onChange={(e) => {
                setGenerateTarget(e.target.value);
                form.resetFields(['group_id', 'student_id']);
              }}
              optionType="button"
              buttonStyle="solid"
            >
              <Radio.Button value="group">Группы (все контрактники)</Radio.Button>
              <Radio.Button value="student">Конкретного студента</Radio.Button>
            </Radio.Group>
          </Form.Item>

          {generateTarget === 'group' ? (
            <Form.Item name="group_id" label="Группа" rules={[{ required: true, message: 'Выберите группу' }]}>
              <Select
                showSearch
                placeholder="Выберите группу"
                options={allGroups?.map((g: any) => ({ label: g.name, value: g.id }))}
              />
            </Form.Item>
          ) : (
            <Form.Item name="student_id" label="Студент" rules={[{ required: true, message: 'Выберите студента' }]}>
              <Select
                showSearch
                placeholder="Введите фамилию или имя"
                filterOption={(input, opt) =>
                  (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={allStudents?.map((s: any) => ({
                  value: s.id,
                  label: `${s.last_name} ${s.first_name} (${s.group?.name ?? '—'})`,
                }))}
              />
            </Form.Item>
          )}

          <Form.Item name="service_type" label="Вид услуги" rules={[{ required: true, message: 'Выберите вид' }]}>
            <Select options={SERVICE_TYPE_OPTIONS} placeholder="Выберите вид услуги" />
          </Form.Item>
          <Form.Item name="amount" label="Сумма (сом)" rules={[{ required: true, message: 'Введите сумму' }]}>
            <InputNumber style={{ width: '100%' }} min={1} placeholder="например 55000" />
          </Form.Item>
          <Form.Item name="semester" label="Семестр" rules={[{ required: true, message: 'Выберите семестр' }]}>
            <Select options={SEMESTERS.map(s => ({ label: `${s} семестр`, value: s }))} />
          </Form.Item>
          <Form.Item name="academic_year" label="Учебный год" rules={[{ required: true, message: 'Выберите год' }]}>
            <Select options={YEARS.map(y => ({ label: y, value: y }))} />
          </Form.Item>
          <Form.Item name="due_date" label="Срок оплаты (необязательно)">
            <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ─── Admin correction modal ─── */}
      <Modal
        title={
          selectedPayment
            ? `Корректировка — ${selectedPayment.student?.last_name} ${selectedPayment.student?.first_name}`
            : 'Корректировка оплаты'
        }
        open={!!selectedPayment}
        onCancel={() => { setSelectedPayment(null); payForm.resetFields(); }}
        onOk={() => payForm.submit()}
        confirmLoading={payMutation.isPending}
        destroyOnHidden
      >
        {selectedPayment && (
          <Alert
            type="info"
            style={{ marginBottom: 16 }}
            message={
              <>
                К оплате: <strong>{Number(selectedPayment.amount_due).toLocaleString()} сом</strong>
                {' · '}
                Оплачено: <strong>{Number(selectedPayment.amount_paid).toLocaleString()} сом</strong>
                {' · '}
                Остаток: <strong>{(Number(selectedPayment.amount_due) - Number(selectedPayment.amount_paid)).toLocaleString()} сом</strong>
              </>
            }
          />
        )}
        <Form form={payForm} layout="vertical" onFinish={(vals) => payMutation.mutate(vals)}>
          <Form.Item
            name="amount_paid"
            label="Сумма внесения (сом)"
            rules={[{ required: true, message: 'Введите сумму' }]}
          >
            <InputNumber style={{ width: '100%' }} min={1} />
          </Form.Item>
          <Form.Item
            name="receipt_number"
            label="Номер квитанции"
            rules={[{ required: true, message: 'Введите номер квитанции' }]}
          >
            <Input placeholder="например ПКО-123456" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
