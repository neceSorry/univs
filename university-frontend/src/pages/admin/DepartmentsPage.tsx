import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Popconfirm, Space, Row, Col } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/api.client';
import { HierarchyFilter } from '../../components/common/HierarchyFilter';

export const DepartmentsPage: React.FC = () => {
  const location = useLocation();
  const state = location.state as { instituteId?: string } | undefined;
  
  const [filter, setFilter] = useState<{ instituteId?: string }>({ instituteId: state?.instituteId });
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['departments', filter.instituteId],
    queryFn: () => apiClient.get(`/departments${filter.instituteId ? `?instituteId=${filter.instituteId}` : ''}`).then(res => res.data.data),
  });

  const { data: institutes, isLoading: instLoad } = useQuery({
    queryKey: ['institutes'],
    queryFn: () => apiClient.get('/institutes').then(res => res.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (values: any) => editingId ? apiClient.post(`/departments/${editingId}`, values) : apiClient.post('/departments', { ...values, instituteId: filter.instituteId }),
    onSuccess: () => {
      message.success(editingId ? 'Кафедра обновлена' : 'Кафедра добавлена');
      setIsModalVisible(false);
      setEditingId(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
    onError: (err: any) => message.error(err.response?.data?.message || 'Ошибка при сохранении')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/departments/${id}`),
    onSuccess: () => {
      message.success('Кафедра удалена');
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
    onError: (err: any) => message.error(err.response?.data?.message || 'Ошибка при удалении')
  });

  const handleEdit = (record: any) => {
    setEditingId(record.id);
    form.setFieldsValue({
      name: record.name,
      short_name: record.short_name,
      instituteId: record.institute?.id
    });
    setIsModalVisible(true);
  };

  const columns = [
    { 
      title: 'Название', 
      dataIndex: 'name', 
      key: 'name',
      render: (text: string, record: any) => (
        <a onClick={() => navigate('/admin/programs', { state: { departmentId: record.id, instituteId: record.institute?.id } })}>{text}</a>
      )
    },
    { title: 'Сокращение', dataIndex: 'short_name', key: 'short_name' },
    { title: 'Институт', dataIndex: ['institute', 'name'], key: 'institute' },
    {
      title: 'Действия',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm title="Удалить кафедру?" onConfirm={() => deleteMutation.mutate(record.id)}>
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2>Кафедры</h2>
      <HierarchyFilter levels={['institute']} onChange={setFilter} initialValues={{ instituteId: state?.instituteId }} />
      
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)} disabled={!filter.instituteId}>
          Добавить
        </Button>
      </div>

      <Table columns={columns} dataSource={data} rowKey="id" loading={isLoading} pagination={false} />

      <Modal 
        title={editingId ? `Редактирование: ${form.getFieldValue('name')}` : "Добавить кафедру"} 
        open={isModalVisible} 
        width={600}
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
            <Form.Item name="instituteId" label="Институт" rules={[{ required: true }]}>
              <Select loading={instLoad}>
                {institutes?.map((i: any) => (
                  <Select.Option key={i.id} value={i.id}>{i.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}

          <Row gutter={16}>
            <Col span={18}>
              <Form.Item name="name" label="Название" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="short_name" label="Сокращение">
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};
