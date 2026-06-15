import React, { useState } from 'react';
import { Table, Button, Modal, Form, Select, Input, InputNumber, message, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/api.client';
import { HierarchyFilter } from '../../components/common/HierarchyFilter';

export const CurriculumPage: React.FC = () => {
  const [filter, setFilter] = useState<any>({});
  const [semester, setSemester] = useState<number>();
  const [availableSemesters, setAvailableSemesters] = useState<number[]>(() => {
    const saved = localStorage.getItem('available_semesters');
    return saved ? JSON.parse(saved) : [1, 2, 3, 4, 5, 6, 7, 8];
  });
  
  const [editingItem, setEditingItem] = useState<any>(null);
  
  React.useEffect(() => {
    localStorage.setItem('available_semesters', JSON.stringify(availableSemesters));
  }, [availableSemesters]);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: plansData, isLoading } = useQuery({
    queryKey: ['curriculum', filter.programId, semester],
    queryFn: () => apiClient.get(`/curriculum?programId=${filter.programId}&semester=${semester}`).then(res => res.data.data),
    enabled: !!filter.programId && !!semester,
  });

  const plan = plansData?.[0];





  const addItemMutation = useMutation({
    mutationFn: async (values: any) => {
      // Шаг 1: Получить или создать план через API (логика на бэкенде защищает от дубликатов)
      const planRes = await apiClient.post('/curriculum', { 
        programId: filter.programId, 
        semester: Number(semester), 
        academic_year: '2023-2024' 
      });
      
      // Бэкенд возвращает объект плана напрямую (не обёрнутый в data:)
      const currentPlan = planRes.data;
      const planId = currentPlan?.id;
      
      if (!planId) throw new Error('Не удалось определить ID плана. Ответ: ' + JSON.stringify(currentPlan));

      // Шаг 2: Добавить дисциплину в план
      return apiClient.post(`/curriculum/${planId}/items`, values);
    },
    onSuccess: () => {
      message.success('Дисциплина добавлена');
      setIsModalVisible(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['curriculum'] });
    },
    onError: (error: any) => {
      console.error('Add item error:', error);
      const msg = error.response?.data?.message || error.message || 'Ошибка при добавлении дисциплины';
      message.error(msg);
    }
  });

  const updateItemMutation = useMutation({
    mutationFn: (values: any) => apiClient.put(`/curriculum/items/${editingItem.id}`, values),
    onSuccess: () => {
      message.success('Дисциплина обновлена');
      setIsModalVisible(false);
      setEditingItem(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['curriculum'] });
    },
    onError: (error: any) => {
      console.error('Update item error:', error);
      message.error('Ошибка при обновлении');
    }
  });

  const updatePlanMutation = useMutation({
    mutationFn: (vals: any) => apiClient.post(`/curriculum/${plan?.id}`, vals),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['curriculum'] }),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/curriculum/items/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['curriculum'] }),
  });

  const handleAddClick = () => {
    setIsModalVisible(true);
  };

  const columns = [
    { title: 'Дисциплина', dataIndex: ['discipline', 'name'], key: 'discipline' },
    { title: 'Лекции (ч)', dataIndex: 'hours_lecture', key: 'hours_lecture' },
    { title: 'Практики (ч)', dataIndex: 'hours_practice', key: 'hours_practice' },
    { title: 'Лабы (ч)', dataIndex: 'hours_lab', key: 'hours_lab' },
    { title: 'Кредиты', dataIndex: 'credits', key: 'credits' },
    { 
      title: (
        <div style={{ minWidth: 200 }}>
          <div style={{ marginBottom: 4 }}>Стоимость (сом)</div>
          <InputNumber 
            style={{ width: '100%' }}
            placeholder="Цена за 1 кр."
            value={plan?.default_credit_price} 
            onChange={(val) => plan && updatePlanMutation.mutate({ default_credit_price: val })}
          />
        </div>
      ), 
      dataIndex: 'total_cost', 
      key: 'total_cost',
      render: (val: number) => <span>{val || 0}</span>
    },
    {
      title: 'Действия',
      key: 'action',
      render: (_: any, record: any) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button 
            icon={<EditOutlined />} 
            onClick={() => {
              setEditingItem(record);
              form.setFieldsValue({
                name: record.discipline.name,
                hours_lecture: record.hours_lecture,
                hours_practice: record.hours_practice,
                hours_lab: record.hours_lab,
                credits: record.credits
              });
              setIsModalVisible(true);
            }} 
          />
          <Popconfirm title="Удалить?" onConfirm={() => deleteItemMutation.mutate(record.id)}>
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div>
      <h2>Учебные планы</h2>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'flex-start' }}>
        <HierarchyFilter levels={['institute', 'department', 'program']} onChange={setFilter} />
        <Select
          style={{ width: 150 }}
          placeholder="Семестр"
          optionLabelProp="label"
          options={availableSemesters.map(s => ({ 
            value: s,
            label: `${s} семестр`,
            display: (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{s} семестр</span>
                <Button 
                  type="text" 
                  size="small" 
                  danger 
                  icon={<DeleteOutlined style={{ fontSize: '12px' }} />} 
                  onClick={(e) => {
                    e.stopPropagation();
                    const newList = availableSemesters.filter(item => item !== s);
                    setAvailableSemesters(newList);
                    if (semester === s) setSemester(undefined);
                  }}
                />
              </div>
            )
          }))}
          onChange={setSemester}
          fieldNames={{ label: 'display', value: 'value' }}
          dropdownRender={(menu) => (
            <>
              {menu}
              <div style={{ padding: '8px', borderTop: '1px solid #e8e8e8', textAlign: 'center' }}>
                <Button 
                  type="link" 
                  icon={<PlusOutlined />} 
                  onClick={() => {
                    const next = availableSemesters.length > 0 ? Math.max(...availableSemesters) + 1 : 1;
                    setAvailableSemesters([...availableSemesters, next]);
                  }}
                >
                  Добавить
                </Button>
              </div>
            </>
          )}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={handleAddClick} 
          disabled={!filter.programId || !semester}
        >
          Добавить дисциплину
        </Button>
      </div>

      <Table 
        columns={columns} 
        dataSource={plan?.items || []} 
        rowKey="id" 
        loading={isLoading || addItemMutation.isPending}
        pagination={false}
        summary={pageData => {
          let totalLec = 0, totalPrac = 0, totalLab = 0, totalCredits = 0, totalCost = 0;
          pageData.forEach((item: any) => {
            totalLec += item.hours_lecture || 0;
            totalPrac += item.hours_practice || 0;
            totalLab += item.hours_lab || 0;
            totalCredits += item.credits || 0;
            totalCost += item.total_cost || 0;
          });
          return (
            <Table.Summary.Row style={{ fontWeight: 'bold' }}>
              <Table.Summary.Cell index={0}>Итого</Table.Summary.Cell>
              <Table.Summary.Cell index={1}>{totalLec}</Table.Summary.Cell>
              <Table.Summary.Cell index={2}>{totalPrac}</Table.Summary.Cell>
              <Table.Summary.Cell index={3}>{totalLab}</Table.Summary.Cell>
              <Table.Summary.Cell index={4}>{totalCredits}</Table.Summary.Cell>
              <Table.Summary.Cell index={5}>{totalCost}</Table.Summary.Cell>
              <Table.Summary.Cell index={6}></Table.Summary.Cell>
            </Table.Summary.Row>
          );
        }}
      />

      <Modal 
        title={editingItem ? "Редактировать дисциплину" : "Добавить дисциплину в план"} 
        open={isModalVisible} 
        onCancel={() => {
          setIsModalVisible(false);
          setEditingItem(null);
          form.resetFields();
        }} 
        onOk={() => form.submit()}
      >
        <Form 
          form={form} 
          layout="vertical" 
          onFinish={(vals) => editingItem ? updateItemMutation.mutate(vals) : addItemMutation.mutate(vals)}
        >
          <Form.Item name="name" label="Название дисциплины" rules={[{ required: true, message: 'Введите название' }]}>
            <Input placeholder="Например: Математический анализ" />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <Form.Item name="hours_lecture" label="Лекционные занятия" initialValue={0}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="hours_practice" label="Практические занятия" initialValue={0}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="hours_lab" label="Лабораторные занятия" initialValue={0}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
            <Form.Item name="credits" label="Кредиты" initialValue={0}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
};
