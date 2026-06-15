import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, message, Popconfirm, Space, Row, Col } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/api.client';
import { HierarchyFilter } from '../../components/common/HierarchyFilter';

export const GroupsPage: React.FC = () => {
  const location = useLocation();
  const state = location.state as { programId?: string; departmentId?: string; instituteId?: string } | undefined;
  
  const [filter, setFilter] = useState<{ instituteId?: string; departmentId?: string; programId?: string }>({
    instituteId: state?.instituteId,
    departmentId: state?.departmentId,
    programId: state?.programId
  });
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['groups', filter.programId],
    queryFn: () => apiClient.get(`/groups${filter.programId ? `?programId=${filter.programId}` : ''}`).then(res => res.data.data),
  });

  const { data: allPrograms, isLoading: progLoad } = useQuery({
    queryKey: ['all-programs'],
    queryFn: () => apiClient.get('/programs').then(res => res.data.data),
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
    mutationFn: (values: any) => editingId ? apiClient.post(`/groups/${editingId}`, values) : apiClient.post('/groups', { ...values, programId: filter.programId }),
    onSuccess: () => {
      message.success(editingId ? 'Группа обновлена' : 'Группа добавлена');
      setIsModalVisible(false);
      setEditingId(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (err: any) => message.error(err.response?.data?.message || 'Ошибка при сохранении')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/groups/${id}`),
    onSuccess: () => {
      message.success('Группа удалена');
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    }
  });

  const handleEdit = (record: any) => {
    setEditingId(record.id);
    form.setFieldsValue({
      name: record.name,
      year_of_entry: record.year_of_entry,
      instituteId: record.program?.department?.institute?.id,
      departmentId: record.program?.department?.id,
      programId: record.program?.id
    });
    setIsModalVisible(true);
  };

  const columns = [
    { 
      title: 'Название', 
      dataIndex: 'name', 
      key: 'name',
      render: (text: string, record: any) => (
        <span 
          style={{ 
            color: '#1677ff',
            cursor: 'pointer',
          }} 
          onClick={() => navigate('/admin/students', { 
            state: { 
              groupId: record.id, 
              programId: record.program?.id, 
              departmentId: record.program?.department?.id, 
              instituteId: record.program?.department?.institute?.id 
            } 
          })}
        >
          {text}
        </span>
      )
    },
    { 
      title: 'Институт', 
      key: 'institute', 
      render: (_: any, record: any) => record.program?.department?.institute?.short_name || record.program?.department?.institute?.name || '-'
    },
    { 
      title: 'Кафедра', 
      dataIndex: ['program', 'department', 'name'], 
      key: 'department',
      render: (text: string) => text || '-'
    },
    { title: 'Направление', dataIndex: ['program', 'name'], key: 'program' },
    { title: 'Год пост.', dataIndex: 'year_of_entry', key: 'year_of_entry' },
    { 
      title: 'Курс', 
      key: 'course', 
      render: (_: any, record: any) => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth(); // 0-11 (8 is September)
        
        // Академический год начинается в сентябре
        const academicYearStart = currentMonth >= 8 ? currentYear : currentYear - 1;
        let course = academicYearStart - record.year_of_entry + 1;
        
        const maxDuration = record.program?.duration_years || 4;
        
        if (course > maxDuration) {
          return 'Выпуск';
        }
        
        return course > 0 ? course : '-';
      }
    },
    { title: 'Студентов', dataIndex: 'studentsCount', key: 'studentsCount', render: (val: number) => val || 0 },
    {
      title: 'Действия',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm title="Удалить группу?" onConfirm={() => deleteMutation.mutate(record.id)}>
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2>Учебные группы</h2>
      <HierarchyFilter 
        levels={['institute', 'department', 'program']} 
        onChange={setFilter} 
        initialValues={{
          instituteId: state?.instituteId,
          departmentId: state?.departmentId,
          programId: state?.programId
        }}
      />
      
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)} disabled={!filter.programId}>
          Добавить
        </Button>
      </div>

      <Table columns={columns} dataSource={data} rowKey="id" loading={isLoading} pagination={false} />

      <Modal 
        title={editingId ? `Редактирование: ${form.getFieldValue('name')}` : "Добавить группу"} 
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
                  onChange={() => {
                    form.setFieldsValue({ departmentId: undefined, programId: undefined });
                  }}
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
                      onChange={() => form.setFieldsValue({ programId: undefined })}
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
              <Form.Item 
                noStyle 
                shouldUpdate={(prev, curr) => prev.departmentId !== curr.departmentId}
              >
                {({ getFieldValue }) => (
                  <Form.Item name="programId" label="Направление подготовки" rules={[{ required: true }]}>
                    <Select 
                      loading={progLoad} 
                      showSearch 
                      optionFilterProp="children"
                      disabled={!getFieldValue('departmentId')}
                    >
                      {allPrograms
                        ?.filter((p: any) => p.department?.id === getFieldValue('departmentId'))
                        .map((p: any) => (
                          <Select.Option key={p.id} value={p.id}>
                            {p.code} - {p.name}
                          </Select.Option>
                        ))}
                    </Select>
                  </Form.Item>
                )}
              </Form.Item>
            </>
          )}

          <Row gutter={16}>
            <Col span={10}>
              <Form.Item name="name" label="Название группы" rules={[{ required: true }]}>
                <Input placeholder="БИ-1-22" />
              </Form.Item>
            </Col>
            <Col span={7}>
              <Form.Item name="year_of_entry" label="Год поступления" rules={[{ required: true }]}>
                <InputNumber min={2000} max={2100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={7}>
              <Form.Item 
                label="Текущий курс" 
                shouldUpdate={(prev, curr) => prev.year_of_entry !== curr.year_of_entry}
              >
                {({ getFieldValue }) => {
                  const entryYear = getFieldValue('year_of_entry');
                  const now = new Date();
                  const academicYearStart = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
                  const course = entryYear ? academicYearStart - entryYear + 1 : 1;
                  return (
                    <Select disabled value={course}>
                      <Select.Option value={course}>{course} курс</Select.Option>
                    </Select>
                  );
                }}
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};
