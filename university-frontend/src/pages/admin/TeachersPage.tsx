import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, message, Popconfirm, Row, Col, Space, Select } from 'antd';
import { PlusOutlined, DeleteOutlined, EyeOutlined, EditOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/api.client';
import { HierarchyFilter } from '../../components/common/HierarchyFilter';

export const TeachersPage: React.FC = () => {
  const [filter, setFilter] = useState<{ departmentId?: string }>({});
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['teachers', filter.departmentId],
    queryFn: () => apiClient.get(`/teachers${filter.departmentId ? `?departmentId=${filter.departmentId}` : ''}`).then(res => res.data.data),
  });

  const { data: teacherDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ['teacherDetails', selectedTeacher?.id],
    queryFn: () => apiClient.get(`/teachers/${selectedTeacher?.id}`).then(res => res.data.data),
    enabled: !!selectedTeacher,
  });

  const { data: allInstitutes, isLoading: instLoad } = useQuery({
    queryKey: ['all-institutes'],
    queryFn: () => apiClient.get('/institutes').then(res => res.data.data),
  });

  const { data: allDepartments, isLoading: depLoad } = useQuery({
    queryKey: ['all-departments-full'],
    queryFn: () => apiClient.get('/departments').then(res => res.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (values: any) => editingId ? apiClient.put(`/teachers/${editingId}`, values) : apiClient.post('/teachers', { ...values, departmentId: filter.departmentId }),
    onSuccess: () => {
      message.success(editingId ? 'Преподаватель обновлен' : 'Преподаватель добавлен');
      setIsModalVisible(false);
      setEditingId(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    },
    onError: (err: any) => message.error(err.response?.data?.message || 'Ошибка')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/teachers/${id}`),
    onSuccess: () => {
      message.success('Преподаватель удален');
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    }
  });

  const handleEdit = (record: any) => {
    setEditingId(record.id);
    form.setFieldsValue({
      first_name: record.first_name,
      last_name: record.last_name,
      middle_name: record.middle_name,
      phone: record.phone,
      position: record.position,
      degree: record.degree,
      email: record.user?.email,
      instituteId: record.department?.institute?.id,
      departmentId: record.department?.id,
    });
    setIsModalVisible(true);
  };

  const columns = [
    { title: 'ФИО', key: 'fio', render: (r: any) => `${r.last_name} ${r.first_name} ${r.middle_name || ''}` },
    { title: 'Телефон', dataIndex: 'phone', key: 'phone' },
    { title: 'Должность', dataIndex: 'position', key: 'position' },
    { title: 'Степень', dataIndex: 'degree', key: 'degree' },
    { title: 'Кафедра', dataIndex: ['department', 'name'], key: 'department' },
    { title: 'Дисциплин', dataIndex: 'disciplinesCount', key: 'disciplinesCount' },
    {
      title: 'Действия',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button icon={<EyeOutlined />} onClick={() => setSelectedTeacher(record)} />
          <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm title="Удалить преподавателя?" onConfirm={() => deleteMutation.mutate(record.id)}>
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2>Преподаватели</h2>
      <HierarchyFilter levels={['institute', 'department']} onChange={setFilter} />
      
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)} disabled={!filter.departmentId}>
          Добавить
        </Button>
      </div>

      <Table columns={columns} dataSource={data} rowKey="id" loading={isLoading} pagination={false} />

      <Modal 
        title={editingId ? "Редактировать преподавателя" : "Добавить преподавателя"} 
        open={isModalVisible} 
        width={600}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingId(null);
          form.resetFields();
        }} 
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={(vals) => createMutation.mutate(vals)}>
          {editingId && (
            <Row gutter={16}>
              <Col span={12}>
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
              </Col>
              <Col span={12}>
                <Form.Item noStyle shouldUpdate={(prev, curr) => prev.instituteId !== curr.instituteId}>
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
              </Col>
            </Row>
          )}
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="last_name" label="Фамилия" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="first_name" label="Имя" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="middle_name" label="Отчество">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="Номер телефона">
                <Input placeholder="+7 (___) ___-__-__" />
              </Form.Item>
            </Col>
          </Row>

          {!editingId && (
            <Form.Item name="password" label="Пароль" rules={[{ required: true, min: 6 }]}>
              <Input.Password />
            </Form.Item>
          )}

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="position" label="Должность">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="degree" label="Ученая степень">
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal 
        title={`Дисциплины: ${selectedTeacher?.first_name} ${selectedTeacher?.last_name}`} 
        open={!!selectedTeacher} 
        onCancel={() => setSelectedTeacher(null)} 
        footer={null}
        width={800}
      >
        <Table 
          loading={detailsLoading}
          rowKey="id"
          dataSource={teacherDetails?.curriculum_items || []}
          pagination={false}
          columns={[
            { title: 'Дисциплина', dataIndex: ['discipline', 'name'] },
            { title: 'Семестр', dataIndex: ['plan', 'semester'] },
            { title: 'Лекции', dataIndex: 'hours_lecture' },
            { title: 'Практики', dataIndex: 'hours_practice' },
            { title: 'Лабы', dataIndex: 'hours_lab' },
            { title: 'Экзамен', dataIndex: 'has_exam', render: v => v ? 'Да' : 'Нет' },
          ]}
        />
      </Modal>
    </div>
  );
};
