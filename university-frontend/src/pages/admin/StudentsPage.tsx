import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, message, Popconfirm, Tag, Row, Col, Space, Spin, DatePicker } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { PlusOutlined, DeleteOutlined, EditOutlined, FileTextOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { apiClient } from '../../api/api.client';
import { HierarchyFilter } from '../../components/common/HierarchyFilter';

export const StudentsPage: React.FC = () => {
  const location = useLocation();
  const state = location.state as { groupId?: string; programId?: string; departmentId?: string; instituteId?: string } | undefined;

  const [filter, setFilter] = useState<any>({
    instituteId: state?.instituteId,
    departmentId: state?.departmentId,
    programId: state?.programId,
    groupId: state?.groupId
  });
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [transcriptStudent, setTranscriptStudent] = useState<{ id: string; name: string; group: string } | null>(null);
  const [editingGrade, setEditingGrade] = useState<{ disciplineId: string; score: number | null; graded_at: Dayjs | null } | null>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: transcriptData, isLoading: transcriptLoading } = useQuery({
    queryKey: ['student-transcript', transcriptStudent?.id],
    queryFn: () => apiClient.get(`/students/${transcriptStudent!.id}/transcript`).then(res => res.data),
    enabled: !!transcriptStudent,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['students', filter.groupId],
    queryFn: () => apiClient.get(`/students${filter.groupId ? `?groupId=${filter.groupId}` : ''}`).then(res => res.data.data),
  });

  const { data: allInstitutes, isLoading: instLoad } = useQuery({
    queryKey: ['all-institutes'],
    queryFn: () => apiClient.get('/institutes').then(res => res.data.data),
  });

  const { data: allDepartments, isLoading: depLoad } = useQuery({
    queryKey: ['all-departments-full'],
    queryFn: () => apiClient.get('/departments').then(res => res.data.data),
  });

  const { data: allPrograms, isLoading: progLoad } = useQuery({
    queryKey: ['all-programs-full'],
    queryFn: () => apiClient.get('/programs').then(res => res.data.data),
  });

  const { data: allGroups, isLoading: groupLoad } = useQuery({
    queryKey: ['all-groups-full'],
    queryFn: () => apiClient.get('/groups').then(res => res.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (values: any) => editingId ? apiClient.post(`/students/${editingId}`, values) : apiClient.post('/students', { ...values, groupId: filter.groupId }),
    onSuccess: () => {
      message.success(editingId ? 'Студент обновлен' : 'Студент добавлен');
      setIsModalVisible(false);
      setEditingId(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (err: any) => message.error(err.response?.data?.message || 'Ошибка')
  });

  const setGradeMutation = useMutation({
    mutationFn: ({ disciplineId, score, graded_at }: { disciplineId: string; score: number; graded_at?: string }) =>
      apiClient.put(`/students/${transcriptStudent!.id}/set-grade`, { disciplineId, score, graded_at }),
    onSuccess: () => {
      message.success('Оценка сохранена');
      setEditingGrade(null);
      queryClient.invalidateQueries({ queryKey: ['student-transcript', transcriptStudent?.id] });
    },
    onError: (err: any) => message.error(err.response?.data?.message || 'Ошибка'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/students/${id}`),
    onSuccess: () => {
      message.success('Студент удален');
      queryClient.invalidateQueries({ queryKey: ['students'] });
    }
  });

  const handleEdit = (record: any) => {
    setEditingId(record.id);
    
    // Попробуем найти полные данные группы в общем списке, если они не пришли со студентом
    const fullGroup = allGroups?.find((g: any) => g.id === record.group?.id) || record.group;
    
    form.setFieldsValue({
      first_name: record.first_name,
      last_name: record.last_name,
      middle_name: record.middle_name,
      phone: record.phone,
      gender: record.gender,
      enrollment_type: record.enrollment_type,
      instituteId: fullGroup?.program?.department?.institute?.id,
      departmentId: fullGroup?.program?.department?.id,
      programId: fullGroup?.program?.id,
      groupId: fullGroup?.id,
    });
    setIsModalVisible(true);
  };

  const columns = [
    { title: 'ФИО', key: 'fio', render: (r: any) => `${r.last_name} ${r.first_name} ${r.middle_name || ''}` },
    { title: 'Email', dataIndex: ['user', 'email'], key: 'email' },
    { title: 'Телефон', dataIndex: 'phone', key: 'phone' },
    { title: 'Группа', dataIndex: ['group', 'name'], key: 'group' },
    { title: 'Тип', dataIndex: 'enrollment_type', key: 'type', render: (val: string) => val === 'budget' ? 'Бюджет' : 'Контракт' },
    { title: 'Статус', dataIndex: 'status', key: 'status', render: (val: string) => <Tag color={val === 'active' ? 'green' : 'red'}>{val === 'active' ? 'Активен' : 'Отчислен'}</Tag> },
    {
      title: 'Действия',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button
            icon={<FileTextOutlined />}
            title="Зачётная книжка"
            onClick={() => setTranscriptStudent({
              id: record.id,
              name: `${record.last_name} ${record.first_name} ${record.middle_name || ''}`.trim(),
              group: record.group?.name ?? '',
            })}
          />
          <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm title="Удалить студента?" onConfirm={() => deleteMutation.mutate(record.id)}>
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2>Студенты</h2>
      <HierarchyFilter
        levels={['institute', 'department', 'program', 'group']}
        onChange={setFilter}
        initialValues={{
          instituteId: state?.instituteId,
          departmentId: state?.departmentId,
          programId: state?.programId,
          groupId: state?.groupId
        }}
      />

      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)} disabled={!filter.groupId}>
          Добавить
        </Button>
      </div>

      <Table columns={columns} dataSource={data} rowKey="id" loading={isLoading} pagination={false} />

      <Modal
        title={
          transcriptStudent
            ? `Зачётная книжка — ${transcriptStudent.name} (${transcriptStudent.group})`
            : 'Зачётная книжка'
        }
        open={!!transcriptStudent}
        onCancel={() => setTranscriptStudent(null)}
        footer={null}
        width={980}
      >
        {transcriptLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : (
          (transcriptData?.data ?? []).map((sem: any) => {
            const course = Math.ceil(sem.semester / 2);
            const columns = [
              { title: '№', key: 'idx', width: 50, render: (_: any, __: any, i: number) => i + 1 },
              {
                title: 'Дисциплина',
                key: 'discipline',
                render: (r: any) => `${r.discipline} [${r.credits} кр.]`,
              },
              { title: 'Кол. час', dataIndex: 'hours', key: 'hours', width: 90, align: 'center' as const },
              {
                title: 'Количество баллов',
                key: 'score',
                width: 130,
                align: 'center' as const,
                render: (r: any) => {
                  const isEditing = editingGrade?.disciplineId === r.disciplineId;
                  if (isEditing) {
                    return (
                      <Space.Compact size="small">
                        <InputNumber
                          min={0} max={100}
                          defaultValue={editingGrade?.score ?? undefined}
                          onChange={(val) => setEditingGrade(prev => prev ? { ...prev, score: val } : null)}
                          style={{ width: 70 }}
                          autoFocus
                        />
                        <Button
                          type="primary" size="small"
                          loading={setGradeMutation.isPending}
                          onClick={() => editingGrade?.score != null && setGradeMutation.mutate({
                            disciplineId: r.disciplineId,
                            score: editingGrade.score,
                            graded_at: editingGrade.graded_at?.toISOString(),
                          })}
                        >✓</Button>
                        <Button size="small" onClick={() => setEditingGrade(null)}>✕</Button>
                      </Space.Compact>
                    );
                  }
                  return (
                    <span
                      style={{ cursor: r.disciplineId ? 'pointer' : 'default', textDecoration: r.disciplineId ? 'underline dotted' : 'none' }}
                      title={r.disciplineId ? 'Нажмите для выставления оценки' : ''}
                      onClick={() => r.disciplineId && setEditingGrade({ disciplineId: r.disciplineId, score: r.score ?? null, graded_at: r.graded_at ? dayjs(r.graded_at) : null })}
                    >
                      {r.score !== null && r.score !== undefined ? Math.round(r.score) : '—'}
                    </span>
                  );
                },
              },
              { title: 'Оценка', dataIndex: 'grade', key: 'grade', width: 80, align: 'center' as const, render: (v: string | null) => v ?? '—' },
              {
                title: 'Дата сдачи',
                key: 'graded_at',
                width: 150,
                align: 'center' as const,
                render: (r: any) => {
                  const isEditing = editingGrade?.disciplineId === r.disciplineId;
                  if (isEditing) {
                    return (
                      <DatePicker
                        size="small"
                        format="DD.MM.YY"
                        value={editingGrade?.graded_at ?? null}
                        onChange={(val) => setEditingGrade(prev => prev ? { ...prev, graded_at: val } : null)}
                        style={{ width: 110 }}
                      />
                    );
                  }
                  return (
                    <span
                      style={{ cursor: r.disciplineId ? 'pointer' : 'default', textDecoration: r.disciplineId ? 'underline dotted' : 'none' }}
                      title={r.disciplineId ? 'Нажмите для изменения даты' : ''}
                      onClick={() => r.disciplineId && setEditingGrade({ disciplineId: r.disciplineId, score: r.score ?? null, graded_at: r.graded_at ? dayjs(r.graded_at) : null })}
                    >
                      {r.graded_at ? new Date(r.graded_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}
                    </span>
                  );
                },
              },
            ];

            return (
              <div key={`${sem.academic_year}_${sem.semester}`} style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', background: '#1677ff', color: '#fff', padding: '6px 12px', fontWeight: 600 }}>
                  <span>{sem.academic_year} учебный год</span>
                  <span>{course}-курс</span>
                </div>
                <div style={{ background: 'rgba(22, 119, 255, 0.15)', padding: '4px 12px', fontWeight: 600, textAlign: 'center' }}>
                  {sem.semester}-семестр
                </div>
                <Table
                  columns={columns}
                  dataSource={sem.items}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  footer={() => (
                    <strong>Итого зарегистрированных кредитов за {sem.semester}-семестр: {sem.total_credits}</strong>
                  )}
                />
              </div>
            );
          })
        )}
        {!transcriptLoading && (transcriptData?.data ?? []).length === 0 && (
          <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>Учебный план не найден</div>
        )}
      </Modal>

      <Modal
        title={editingId ? "Редактировать студента" : "Добавить студента"}
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
            <>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="instituteId" label="Институт" rules={[{ required: true }]}>
                    <Select 
                      loading={instLoad} 
                      onChange={() => form.setFieldsValue({ departmentId: undefined, programId: undefined, groupId: undefined })}
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
                          onChange={() => form.setFieldsValue({ programId: undefined, groupId: undefined })}
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
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item noStyle shouldUpdate={(prev, curr) => prev.departmentId !== curr.departmentId}>
                    {({ getFieldValue }) => (
                      <Form.Item name="programId" label="Направление" rules={[{ required: true }]}>
                        <Select 
                          loading={progLoad}
                          disabled={!getFieldValue('departmentId')}
                          onChange={() => form.setFieldsValue({ groupId: undefined })}
                        >
                          {allPrograms
                            ?.filter((p: any) => p.department?.id === getFieldValue('departmentId'))
                            .map((p: any) => (
                              <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>
                            ))}
                        </Select>
                      </Form.Item>
                    )}
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item noStyle shouldUpdate={(prev, curr) => prev.programId !== curr.programId}>
                    {({ getFieldValue }) => (
                      <Form.Item name="groupId" label="Группа" rules={[{ required: true }]}>
                        <Select 
                          loading={groupLoad}
                          disabled={!getFieldValue('programId')}
                        >
                          {allGroups
                            ?.filter((g: any) => g.program?.id === getFieldValue('programId'))
                            .map((g: any) => (
                              <Select.Option key={g.id} value={g.id}>{g.name}</Select.Option>
                            ))}
                        </Select>
                      </Form.Item>
                    )}
                  </Form.Item>
                </Col>
              </Row>
            </>
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

          {!editingId && (
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="username" label="Логин" rules={[{ required: true, message: 'Введите логин' }]}>
                  <Input placeholder="например: ivanov_ivan" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="password" label="Пароль" rules={[{ required: true, min: 6 }]}>
                  <Input.Password />
                </Form.Item>
              </Col>
            </Row>
          )}
          {!editingId && (
            <Row gutter={16}>
              <Col span={24}>
                <Form.Item name="email" label="Email (необязательно)" rules={[{ type: 'email', message: 'Введите корректный email' }]}>
                  <Input placeholder="необязательно" />
                </Form.Item>
              </Col>
            </Row>
          )}

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="phone" label="Номер телефона">
                <Input placeholder="+7 (___) ___-__-__" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="gender" label="Пол" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="male">Мужской</Select.Option>
                  <Select.Option value="female">Женский</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="enrollment_type" label="Тип обучения" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="budget">Бюджет</Select.Option>
              <Select.Option value="contract">Контракт</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
