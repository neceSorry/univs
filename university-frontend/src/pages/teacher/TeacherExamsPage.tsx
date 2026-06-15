import React, { useState, useEffect } from 'react';
import { Card, Button, Table, Typography, Row, Col, Modal, Form, Checkbox, message, InputNumber, Select, DatePicker, Input, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/api.client';
import dayjs from 'dayjs';

const { Title, Text } = Typography;



export const TeacherExamsPage: React.FC = () => {
  const [selectedExam, setSelectedExam] = useState<any>(null);
  const [isRequestModalVisible, setIsRequestModalVisible] = useState(false);
  const [gradeForm] = Form.useForm();
  const [requestForm] = Form.useForm();
  const queryClient = useQueryClient();

  const watchedDisciplineId = Form.useWatch('discipline_id', requestForm);
  const watchedGroupId = Form.useWatch('group_id', requestForm);

  const { data: planInfo } = useQuery({
    queryKey: ['teacher-exam-plan-info', watchedDisciplineId, watchedGroupId],
    queryFn: () =>
      apiClient
        .get(`/teacher/exam-plan-info?disciplineId=${watchedDisciplineId}&groupId=${watchedGroupId}`)
        .then(r => r.data.data),
    enabled: !!watchedDisciplineId && !!watchedGroupId && isRequestModalVisible,
  });

  useEffect(() => {
    if (!planInfo) return;
    if (planInfo.semester) requestForm.setFieldValue('semester', planInfo.semester);
  }, [planInfo, requestForm]);

  const { data: exams } = useQuery({
    queryKey: ['teacher-my-exams'],
    queryFn: () => apiClient.get('/teacher/my-exams').then(res => res.data.data),
  });

  const { data: myDisciplines } = useQuery({
    queryKey: ['teacher-my-disciplines'],
    queryFn: () => apiClient.get('/teacher/my-disciplines').then(res => res.data.data),
    enabled: isRequestModalVisible,
  });

  const { data: myGroups } = useQuery({
    queryKey: ['teacher-my-groups'],
    queryFn: () => apiClient.get('/teacher/my-groups').then(res => res.data.data),
    enabled: isRequestModalVisible,
  });

  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ['exam-students', selectedExam?.id],
    queryFn: () => apiClient.get(`/teacher/my-groups/${selectedExam?.group.id}/students`).then(res => res.data.data),
    enabled: !!selectedExam,
  });

  const requestMutation = useMutation({
    mutationFn: (values: any) => apiClient.post('/teacher/my-exams/request', {
      ...values,
      exam_date: values.exam_date.toISOString(),
    }),
    onSuccess: () => {
      message.success('Заявка отправлена администратору');
      setIsRequestModalVisible(false);
      requestForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['teacher-my-exams'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/teacher/my-exams/${id}`),
    onSuccess: () => {
      message.success('Заявка удалена');
      queryClient.invalidateQueries({ queryKey: ['teacher-my-exams'] });
    },
  });

  const saveResultsMutation = useMutation({
    mutationFn: (values: any) => {
      const results = students.map((s: any) => ({
        student_id: s.id,
        is_admitted: values[`admit_${s.id}`],
        grade: values[`grade_${s.id}`],
      }));
      return apiClient.post(`/exams/${selectedExam.id}/results/bulk`, { results });
    },
    onSuccess: () => {
      message.success('Ведомость сохранена');
      setSelectedExam(null);
      gradeForm.resetFields();
    },
  });

  const isPlanLoading = !!watchedDisciplineId && !!watchedGroupId && !planInfo;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>Мои Экзамены</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsRequestModalVisible(true)}>
          Подать заявку на экзамен
        </Button>
      </div>

      <Row gutter={[16, 16]}>
        {exams?.map((e: any) => (
          <Col span={8} key={e.id}>
            <Card
              title={
                <span style={{ whiteSpace: 'normal', wordBreak: 'break-word', paddingRight: 8 }}>
                  {e.discipline?.name}
                </span>
              }
              actions={[]}
              extra={
                <Popconfirm
                  title="Удалить заявку?"
                  description="Это действие нельзя отменить."
                  onConfirm={() => deleteMutation.mutate(e.id)}
                  okText="Удалить"
                  okButtonProps={{ danger: true }}
                  cancelText="Отмена"
                >
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    loading={deleteMutation.isPending}
                  />
                </Popconfirm>
              }
            >
              <Text>Группа: {e.group?.name}</Text><br />
              <Text>Дата: {dayjs(e.exam_date).format('DD.MM.YYYY HH:mm')}</Text><br />
              <Text>Тип: {e.type === 'exam' ? 'Экзамен' : 'Курсовая работа'}</Text><br />
              {e.classroom_text && <Text>Аудитория: {e.classroom_text}</Text>}
            </Card>
          </Col>
        ))}
        {(!exams || exams.length === 0) && (
          <Col span={24}>
            <Text type="secondary">У вас пока нет заявок на экзамены. Нажмите «Подать заявку на экзамен».</Text>
          </Col>
        )}
      </Row>

      {/* Exam Request Modal */}
      <Modal
        title="Подать заявку на экзамен"
        open={isRequestModalVisible}
        onCancel={() => { setIsRequestModalVisible(false); requestForm.resetFields(); }}
        onOk={() => requestForm.submit()}
        confirmLoading={requestMutation.isPending}
        okText="Отправить заявку"
      >
        <Form form={requestForm} layout="vertical" onFinish={(vals) => requestMutation.mutate(vals)}>
          <Form.Item name="discipline_id" label="Дисциплина" rules={[{ required: true, message: 'Выберите дисциплину' }]}>
            <Select
              showSearch
              placeholder="Выберите дисциплину"
              options={myDisciplines?.map((d: any) => ({ label: d.name, value: d.id }))}
            />
          </Form.Item>
          <Form.Item name="group_id" label="Группа" rules={[{ required: true, message: 'Выберите группу' }]}>
            <Select
              showSearch
              placeholder="Выберите группу"
              options={myGroups?.map((g: any) => ({ label: g.name, value: g.id }))}
            />
          </Form.Item>
          <Form.Item name="semester" label="Семестр" rules={[{ required: true, message: 'Выберите семестр' }]}>
            <Select
              placeholder={isPlanLoading ? 'Определяется...' : 'Выберите семестр'}
              options={[1, 2, 3, 4, 5, 6, 7, 8].map(s => ({ label: `${s} семестр`, value: s }))}
            />
          </Form.Item>
          <Form.Item name="type" label="Тип" rules={[{ required: true, message: 'Выберите тип' }]}>
            <Select options={[{ label: 'Экзамен', value: 'exam' }, { label: 'Курсовая работа', value: 'credit' }]} />
          </Form.Item>
          <Form.Item name="exam_date" label="Дата и время" rules={[{ required: true, message: 'Укажите дату' }]}>
            <DatePicker showTime style={{ width: '100%' }} format="DD.MM.YYYY HH:mm" />
          </Form.Item>
          <Form.Item name="classroom_text" label="Аудитория (необязательно)">
            <Input placeholder="Например: 412" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Grade Entry Modal */}
      <Modal
        title={`Ведомость: ${selectedExam?.discipline?.name} (${selectedExam?.group?.name})`}
        open={!!selectedExam}
        onCancel={() => { setSelectedExam(null); gradeForm.resetFields(); }}
        onOk={() => gradeForm.submit()}
        width={800}
        confirmLoading={saveResultsMutation.isPending}
        okText="Сохранить ведомость"
      >
        <Form form={gradeForm} layout="vertical" onFinish={(vals) => saveResultsMutation.mutate(vals)}>
          <Table
            dataSource={students || []}
            rowKey="id"
            pagination={false}
            loading={studentsLoading}
            columns={[
              { title: 'ФИО Студента', render: (r: any) => `${r.last_name} ${r.first_name}` },
              {
                title: 'Допуск',
                key: 'admit',
                render: (r: any) => (
                  <Form.Item name={`admit_${r.id}`} valuePropName="checked" initialValue={true} style={{ margin: 0 }}>
                    <Checkbox />
                  </Form.Item>
                ),
              },
              {
                title: 'Оценка (0–100)',
                key: 'grade',
                render: (r: any) => (
                  <Form.Item name={`grade_${r.id}`} rules={[{ required: true, message: ' ' }]} style={{ margin: 0 }}>
                    <InputNumber min={0} max={100} />
                  </Form.Item>
                ),
              },
            ]}
          />
        </Form>
      </Modal>
    </div>
  );
};
