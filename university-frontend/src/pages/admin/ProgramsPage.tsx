import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, InputNumber, message, Popconfirm, Space, Row, Col } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/api.client';
import { HierarchyFilter } from '../../components/common/HierarchyFilter';

export const ProgramsPage: React.FC = () => {
  const location = useLocation();
  const state = location.state as { departmentId?: string; instituteId?: string } | undefined;
  
  const [filter, setFilter] = useState<{ instituteId?: string; departmentId?: string }>({ 
    instituteId: state?.instituteId,
    departmentId: state?.departmentId 
  });
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['programs', filter.departmentId],
    queryFn: () => apiClient.get(`/programs${filter.departmentId ? `?departmentId=${filter.departmentId}` : ''}`).then(res => res.data.data),
  });

  const { data: allDepartments, isLoading: depLoad } = useQuery({
    queryKey: ['all-departments'],
    queryFn: () => apiClient.get('/departments').then(res => res.data.data),
  });

  const { data: allInstitutes, isLoading: instLoad } = useQuery({
    queryKey: ['all-institutes'],
    queryFn: () => apiClient.get('/institutes').then(res => res.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (values: any) => editingId ? apiClient.post(`/programs/${editingId}`, values) : apiClient.post('/programs', { ...values, departmentId: filter.departmentId }),
    onSuccess: () => {
      message.success(editingId ? 'Направление обновлено' : 'Направление добавлено');
      setIsModalVisible(false);
      setEditingId(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['programs'] });
    },
    onError: (err: any) => message.error(err.response?.data?.message || 'Ошибка при сохранении')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/programs/${id}`),
    onSuccess: () => {
      message.success('Направление удалено');
      queryClient.invalidateQueries({ queryKey: ['programs'] });
    },
    onError: (err: any) => message.error(err.response?.data?.message || 'Ошибка при удалении')
  });

  const handleEdit = (record: any) => {
    setEditingId(record.id);
    form.setFieldsValue({
      name: record.name,
      code: record.code,
      degree: record.degree,
      duration_years: record.duration_years,
      instituteId: record.department?.institute?.id,
      departmentId: record.department?.id
    });
    setIsModalVisible(true);
  };

  const columns = [
    { 
      title: 'Название', 
      dataIndex: 'name', 
      key: 'name',
      render: (text: string, record: any) => (
        <a onClick={() => navigate('/admin/groups', { state: { programId: record.id, departmentId: record.department?.id, instituteId: record.department?.institute?.id } })}>{text}</a>
      )
    },
    { title: 'Код', dataIndex: 'code', key: 'code' },
    { title: 'Степень', dataIndex: 'degree', key: 'degree', render: (val: string) => val === 'bachelor' ? 'Бакалавриат' : val === 'master' ? 'Магистратура' : val },
    { title: 'Срок обучения', dataIndex: 'duration_years', key: 'duration_years', render: (val: number) => `${val} года/лет` },
    { title: 'Кафедра', dataIndex: ['department', 'name'], key: 'department' },
    {
      title: 'Действия',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm title="Удалить направление?" onConfirm={() => deleteMutation.mutate(record.id)}>
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2>Направления подготовки</h2>
      <HierarchyFilter 
        levels={['institute', 'department']} 
        onChange={setFilter} 
        initialValues={{ instituteId: state?.instituteId, departmentId: state?.departmentId }} 
      />
      
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)} disabled={!filter.departmentId}>
          Добавить
        </Button>
      </div>

      <Table columns={columns} dataSource={data} rowKey="id" loading={isLoading} pagination={false} />

      <Modal 
        title={editingId ? `Редактирование: ${form.getFieldValue('name')}` : "Добавить направление"} 
        open={isModalVisible} 
        width={700}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingId(null);
          form.resetFields();
        }} 
        onOk={() => form.submit()}
        okText="Сохранить изменения"
        cancelText="Отмена"
      >
        <Form form={form} layout="vertical" onFinish={(vals) => createMutation.mutate(vals)}>
          {editingId && (
            <>
              <Form.Item name="instituteId" label="Институт" rules={[{ required: true }]}>
                <Select 
                  loading={instLoad} 
                  onChange={() => form.setFieldsValue({ departmentId: undefined })}
                >
                  {allInstitutes?.map((i: any) => (
                    <Select.Option key={i.id} value={i.id}>{i.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item 
                noStyle 
                shouldUpdate={(prev, curr) => prev.instituteId !== curr.instituteId}
              >
                {({ getFieldValue }) => (
                  <Form.Item name="departmentId" label="Кафедра" rules={[{ required: true }]}>
                    <Select 
                      loading={depLoad}
                      disabled={!getFieldValue('instituteId')}
                    >
                      {allDepartments
                        ?.filter((d: any) => d.institute?.id === getFieldValue('instituteId'))
                        .map((d: any) => (
                          <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>
                        ))}
                    </Select>
                  </Form.Item>
                )}
              </Form.Item>
            </>
          )}

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="code" label="Код направления" rules={[{ required: true }]}>
                <Input placeholder="510200" />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item name="name" label="Название" rules={[{ required: true }]}>
                <Input placeholder="Прикладная математика и информатика" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="degree" label="Уровень образования" rules={[{ required: true }]} initialValue="bachelor">
                <Select>
                  <Select.Option value="bachelor">Бакалавриат</Select.Option>
                  <Select.Option value="master">Магистратура</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="duration_years" label="Срок обучения (лет)" rules={[{ required: true }]} initialValue={4}>
                <InputNumber min={1} max={6} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};
