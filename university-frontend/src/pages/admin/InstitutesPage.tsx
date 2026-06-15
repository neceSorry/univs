import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, message, Popconfirm, Space } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/api.client';

export const InstitutesPage: React.FC = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['institutes'],
    queryFn: () => apiClient.get('/institutes').then(res => res.data.data)
  });

  const createMutation = useMutation({
    mutationFn: (values: any) => editingId ? apiClient.post(`/institutes/${editingId}`, values) : apiClient.post('/institutes', values),
    onSuccess: () => {
      message.success(editingId ? 'Институт обновлен' : 'Институт добавлен');
      setIsModalVisible(false);
      setEditingId(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['institutes'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/institutes/${id}`),
    onSuccess: () => {
      message.success('Институт удален');
      queryClient.invalidateQueries({ queryKey: ['institutes'] });
    }
  });

  const handleEdit = (record: any) => {
    setEditingId(record.id);
    form.setFieldsValue(record);
    setIsModalVisible(true);
  };

  const columns = [
    { 
      title: 'Название', 
      dataIndex: 'name', 
      key: 'name',
      render: (text: string, record: any) => (
        <a onClick={() => navigate('/admin/departments', { state: { instituteId: record.id } })}>{text}</a>
      )
    },
    { title: 'Сокращение', dataIndex: 'short_name', key: 'short_name' },
    { title: 'Кафедры', dataIndex: 'departmentsCount', key: 'departmentsCount' },
    {
      title: 'Действия',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm title="Удалить институт?" onConfirm={() => deleteMutation.mutate(record.id)}>
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>Институты</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)}>
          Добавить
        </Button>
      </div>

      <Table columns={columns} dataSource={data} rowKey="id" loading={isLoading} pagination={false} />

      <Modal 
        title={editingId ? "Редактировать институт" : "Добавить институт"} 
        open={isModalVisible} 
        onCancel={() => {
          setIsModalVisible(false);
          setEditingId(null);
          form.resetFields();
        }} 
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={(vals) => createMutation.mutate(vals)}>
          <Form.Item name="name" label="Название" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="short_name" label="Сокращение">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
