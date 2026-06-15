import React, { useState } from 'react';
import {
  Table, Button, Modal, Form, Input, Checkbox, Tag, Popconfirm,
  message, Typography, Space, Divider,
} from 'antd';
import { PlusOutlined, DeleteOutlined, SafetyOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/api.client';
import { usePermissions } from '../../hooks/usePermissions';

const { Title, Text } = Typography;

const PERMISSION_GROUPS = [
  {
    label: 'Структура',
    items: [
      { code: 'structure.write', label: 'Изменение структуры университета' },
      { code: 'view.structure', label: 'Просмотр структуры университета' },
    ],
  },
  {
    label: 'Люди',
    items: [
      { code: 'people.write', label: 'Добавление и удаление людей' },
      { code: 'view.people', label: 'Просмотр преподавателей и студентов' },
    ],
  },
  {
    label: 'Учебные планы',
    items: [
      { code: 'curriculum.write', label: 'Редактирование учебных планов' },
      { code: 'view.curriculum', label: 'Просмотр учебных планов' },
    ],
  },
  {
    label: 'Расписание',
    items: [
      { code: 'schedule.input', label: 'Вносить данные для расписания' },
      { code: 'schedule.generate', label: 'Запускать генерацию расписания' },
      { code: 'schedule.edit', label: 'Корректировать расписание вручную' },
      { code: 'schedule.publish', label: 'Утверждать и публиковать расписание' },
    ],
  },
  {
    label: 'Успеваемость',
    items: [
      { code: 'view.grades', label: 'Просмотр оценок студентов' },
      { code: 'grades.write', label: 'Выставление оценок вручную' },
      { code: 'grades.override', label: 'Выставление оценок после срока' },
    ],
  },
  {
    label: 'Экзамены и финансы',
    items: [
      { code: 'view.exams', label: 'Просмотр экзаменов' },
      { code: 'exams.write', label: 'Управление экзаменами' },
      { code: 'payments.write', label: 'Управление оплатами' },
      { code: 'analytics.view', label: 'Просмотр аналитики' },
    ],
  },
];


export const AdminsManagePage: React.FC = () => {
  const { isSuperAdmin } = usePermissions();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [permForm] = Form.useForm();
  const [createOpen, setCreateOpen] = useState(false);
  const [permOpen, setPermOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<any>(null);

  const { data: admins, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => apiClient.get('/admin-permissions/users').then(r => r.data),
    enabled: isSuperAdmin,
  });

  const createMutation = useMutation({
    mutationFn: (vals: any) => apiClient.post('/admin-permissions/users', vals),
    onSuccess: () => {
      message.success('Администратор создан');
      setCreateOpen(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: any) => message.error(err.response?.data?.message || 'Ошибка создания'),
  });

  const updatePermMutation = useMutation({
    mutationFn: ({ userId, permissions }: any) =>
      apiClient.put(`/admin-permissions/users/${userId}/permissions`, { permissions }),
    onSuccess: () => {
      message.success('Права обновлены');
      setPermOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => apiClient.delete(`/admin-permissions/users/${userId}`),
    onSuccess: () => {
      message.success('Администратор удалён');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: any) => message.error(err.response?.data?.message || 'Нельзя удалить'),
  });

  if (!isSuperAdmin) {
    return <div style={{ padding: 40 }}><Text type="danger">Доступ запрещён — только для главного администратора</Text></div>;
  }

  const columns = [
    {
      title: 'Пользователь',
      key: 'user',
      render: (_: any, row: any) => {
        const u = row.user;
        return (
          <Space>
            <span style={{ fontWeight: 500 }}>{u?.username || u?.email}</span>
            {u?.is_super_admin && <Tag color="red">Super Admin</Tag>}
          </Space>
        );
      },
    },
    {
      title: 'Права',
      dataIndex: 'permissions',
      key: 'permissions',
      render: (perms: string[], row: any) => {
        const total = PERMISSION_GROUPS.flatMap(g => g.items).length;
        if (row.user?.is_super_admin) return <Tag color="red">Все права</Tag>;
        if (perms.length === 0) return <Text type="secondary">Нет прав</Text>;
        return (
          <Tag color="blue">{perms.length} из {total} прав</Tag>
        );
      },
    },
    {
      title: 'Создан',
      dataIndex: ['user', 'created_at'],
      key: 'created_at',
      render: (d: string) => d ? new Date(d).toLocaleDateString('ru-RU') : '—',
      width: 120,
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 150,
      render: (_: any, row: any) => (
        <Space>
          <Button
            icon={<SafetyOutlined />}
            size="small"
            onClick={() => {
              setSelectedAdmin(row);
              const allCodes = PERMISSION_GROUPS.flatMap(g => g.items.map(i => i.code));
              permForm.setFieldsValue({
                permissions: row.user?.is_super_admin ? allCodes : row.permissions,
              });
              setPermOpen(true);
            }}
          >
            Права
          </Button>
          {!row.user?.is_super_admin && (
            <Popconfirm
              title="Удалить администратора?"
              okType="danger"
              onConfirm={() => deleteMutation.mutate(row.user.id)}
            >
              <Button danger icon={<DeleteOutlined />} size="small" />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>Управление администраторами</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          Создать администратора
        </Button>
      </div>

      <Table
        dataSource={admins || []}
        columns={columns}
        rowKey={(r: any) => r.user?.id}
        loading={isLoading}
        pagination={false}
      />

      {/* Create Modal */}
      <Modal
        title="Создать администратора"
        open={createOpen}
        onCancel={() => { setCreateOpen(false); form.resetFields(); }}
        onOk={() => form.submit()}
        okText="Создать"
        cancelText="Отмена"
        width={720}
      >
        <Form form={form} layout="vertical" onFinish={vals => createMutation.mutate(vals)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <Form.Item name="first_name" label="Имя">
              <Input />
            </Form.Item>
            <Form.Item name="last_name" label="Фамилия">
              <Input />
            </Form.Item>
            <Form.Item name="middle_name" label="Отчество">
              <Input />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="username" label="Логин" rules={[{ required: true, message: 'Введите логин' }]}>
              <Input placeholder="например: ivanov" />
            </Form.Item>
            <Form.Item name="password" label="Пароль" rules={[{ required: true, min: 6, message: 'Минимум 6 символов' }]}>
              <Input.Password />
            </Form.Item>
          </div>
          <Divider style={{ margin: '8px 0 12px' }}>Права доступа</Divider>
          <Form.Item name="permissions" initialValue={[]}>
            <Checkbox.Group style={{ width: '100%' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 24px' }}>
                {PERMISSION_GROUPS.map(group => (
                  <div key={group.label}>
                    <Text strong style={{ display: 'block', marginBottom: 4, color: '#555', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {group.label}
                    </Text>
                    {group.items.map(item => (
                      <div key={item.code} style={{ marginBottom: 4 }}>
                        <Checkbox value={item.code} style={{ fontSize: 13 }}>{item.label}</Checkbox>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </Checkbox.Group>
          </Form.Item>
        </Form>
      </Modal>

      {/* Permissions Modal */}
      <Modal
        title={`Права: ${selectedAdmin?.user?.username || selectedAdmin?.user?.email}`}
        open={permOpen}
        onCancel={() => setPermOpen(false)}
        onOk={() => permForm.submit()}
        okText="Сохранить"
        cancelText="Отмена"
        width={720}
      >
        <Form
          form={permForm}
          onFinish={vals =>
            updatePermMutation.mutate({
              userId: selectedAdmin?.user?.id,
              permissions: vals.permissions || [],
            })
          }
        >
          <Form.Item name="permissions" initialValue={[]}>
            <Checkbox.Group style={{ width: '100%' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 24px' }}>
                {PERMISSION_GROUPS.map(group => (
                  <div key={group.label}>
                    <Text strong style={{ display: 'block', marginBottom: 4, color: '#555', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {group.label}
                    </Text>
                    {group.items.map(item => (
                      <div key={item.code} style={{ marginBottom: 4 }}>
                        <Checkbox value={item.code} style={{ fontSize: 13 }}>{item.label}</Checkbox>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </Checkbox.Group>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
