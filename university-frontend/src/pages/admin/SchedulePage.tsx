import React, { useState, useEffect } from 'react';
import {
  Tabs, Card, Button, Form, Select, Typography, message, Progress,
  Table, Modal, Checkbox, InputNumber, Input, Drawer, Tag, Popconfirm, Collapse, Space, Radio, Divider, Badge, theme
} from 'antd';
import { DeleteOutlined, WarningOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DndContext, DragOverlay, useDraggable, useDroppable, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { apiClient } from '../../api/api.client';
import { usePermissions } from '../../hooks/usePermissions';

const { Title, Text } = Typography;

const PERIOD_TIMES: Record<number, string> = {
  1: '10:00', 2: '11:30', 3: '13:00', 4: '15:00', 5: '16:30', 6: '18:00',
};

const LESSON_LABELS: Record<string, string> = {
  lecture: 'Лек.', practice: 'Пр.', lab: 'Лаб.',
};

const LessonCard: React.FC<{ slot: any; onEdit?: (slot: any) => void }> = ({ slot, onEdit }) => {
  const { token } = theme.useToken();
  const typeLabel = LESSON_LABELS[slot.lesson_type] ?? '';
  return (
    <div
      style={{
        padding: '4px 8px', background: token.colorFillAlter,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 4, fontSize: 12, userSelect: 'none', position: 'relative',
      }}
    >
      <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: onEdit ? 18 : 0 }}>
        {slot.discipline?.name}
        {slot.is_manual_override && <WarningOutlined style={{ marginLeft: 4, fontSize: 10 }} title="Изменено вручную" />}
      </div>
      <div style={{ color: token.colorTextSecondary, fontSize: 11 }}>
        {typeLabel && <span style={{ color: token.colorTextTertiary, marginRight: 4 }}>{typeLabel}</span>}
        {slot.teacher?.last_name} {slot.teacher?.first_name?.[0]}.
      </div>
      <div style={{ color: token.colorTextTertiary, fontSize: 11 }}>Ауд: {slot.classroom?.number || slot.classroom_text || '—'}</div>
      {slot.week_type !== 'all' && (
        <span style={{ fontSize: 10, color: token.colorPrimary, fontWeight: 500 }}>
          {slot.week_type === 'odd' ? 'Нечет.' : 'Чет.'}
        </span>
      )}
      {onEdit && (
        <EditOutlined
          onClick={(e) => { e.stopPropagation(); onEdit(slot); }}
          style={{ position: 'absolute', top: 4, right: 4, color: token.colorTextDisabled, fontSize: 11, cursor: 'pointer' }}
        />
      )}
    </div>
  );
};

const DraggableLesson: React.FC<{ slot: any; onEdit: (slot: any) => void }> = ({ slot, onEdit }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: slot.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ marginBottom: 4, opacity: isDragging ? 0.25 : 1, cursor: 'grab' }}
    >
      <LessonCard slot={slot} onEdit={onEdit} />
    </div>
  );
};

const DroppableCell: React.FC<{ day: number; period: number; children: React.ReactNode }> = ({ day, period, children }) => {
  const { token } = theme.useToken();
  const { setNodeRef, isOver } = useDroppable({ id: `cell-${day}-${period}` });
  return (
    <td
      ref={setNodeRef}
      style={{
        border: `1px solid ${token.colorBorderSecondary}`, padding: '4px 6px', verticalAlign: 'top',
        minHeight: 88, width: '16%',
        background: isOver ? token.colorPrimaryBg : 'transparent',
        transition: 'background 0.12s',
      }}
    >
      {React.Children.count(children) === 0
        ? <div style={{ minHeight: 60, color: token.colorTextDisabled, textAlign: 'center', paddingTop: 22, fontSize: 11 }}>—</div>
        : children
      }
    </td>
  );
};

function getCurrentAcademicYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  return month >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

export const SchedulePage: React.FC = () => {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const { token } = theme.useToken();
  const [activeTab, setActiveTab] = useState('1');

  // Unified Context State
  const [instituteId, setInstituteId] = useState<string>();
  const [departmentId, setDepartmentId] = useState<string>();
  const [programId, setProgramId] = useState<string>();
  const [academicYear, setAcademicYear] = useState<string>(getCurrentAcademicYear());
  const [period, setPeriod] = useState<'autumn' | 'spring'>('autumn');

  // --- Common Queries ---
  const { data: institutes } = useQuery({
    queryKey: ['institutes'],
    queryFn: () => apiClient.get('/institutes').then(res => res.data.data),
  });

  const { data: departments } = useQuery({
    queryKey: ['departments', instituteId],
    queryFn: () => apiClient.get(`/departments?instituteId=${instituteId}`).then(res => res.data.data),
    enabled: !!instituteId,
  });

  const { data: programs } = useQuery({
    queryKey: ['programs', departmentId],
    queryFn: () => apiClient.get(`/programs?departmentId=${departmentId}`).then(res => res.data.data),
    enabled: !!departmentId,
  });

  // --- TAB 1: Data ---
  const { data: directionData, isLoading: isLoadingDirection } = useQuery({
    queryKey: ['schedule-direction-data', programId, academicYear, period],
    queryFn: () => apiClient.get(`/schedule/direction-data`, { params: { programId, academicYear, period } }).then(res => res.data),
    enabled: !!programId && !!academicYear && !!period && activeTab === '1',
  });

  const assignTeacherMutation = useMutation({
    mutationFn: ({ itemId, lessonType, teacherId }: { itemId: string, lessonType: string, teacherId: string | null }) =>
      apiClient.put(`/curriculum/items/${itemId}/assign-teacher`, { lesson_type: lessonType, teacher_id: teacherId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-direction-data'] });
    },
    onError: () => message.error('Ошибка при назначении преподавателя')
  });

  const assignClassroomMutation = useMutation({
    mutationFn: ({ itemId, lessonType, classroomName }: { itemId: string, lessonType: string, classroomName: string | null }) =>
      apiClient.put(`/curriculum/items/${itemId}/assign-classroom`, { lesson_type: lessonType, classroom_name: classroomName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-direction-data'] });
    },
    onError: () => message.error('Ошибка при назначении аудитории')
  });

  const handleAssignClassroom = (itemId: string, lessonType: string, classroomName: string | null) => {
    assignClassroomMutation.mutate({ itemId, lessonType, classroomName });
  };

  const savePrefMutation = useMutation({
    mutationFn: (vals: any) => apiClient.post('/teacher-preferences', vals),
    onSuccess: () => {
      message.success('Пожелания сохранены');
      setPrefModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['schedule-direction-data'] });
    },
    onError: () => message.error('Ошибка при сохранении пожеланий')
  });

  const [prefModalOpen, setPrefModalOpen] = useState(false);
  const [prefViewOnly, setPrefViewOnly] = useState(false);
  const [prefForm] = Form.useForm();
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);

  const handleAssignTeacher = (itemId: string, lessonType: string, teacherId: string | null) => {
    assignTeacherMutation.mutate({ itemId, lessonType, teacherId });
  };

  const openPreferenceModal = async (teacher: any, semester: number, viewOnly = false) => {
    setSelectedTeacher(teacher);
    setPrefViewOnly(viewOnly);
    prefForm.setFieldsValue({
      teacher_id: teacher.id,
      semester,
      academic_year: academicYear,
      work_rate: 1.0,
      max_periods_per_day: 3,
      unavailable_days: [],
      preferred_periods: [],
      notes: '',
    });
    setPrefModalOpen(true);
    try {
      const res = await apiClient.get(`/teacher-preferences/${teacher.id}`, {
        params: { semester, academicYear },
      });
      const pref = res.data;
      if (pref) {
        prefForm.setFieldsValue({
          teacher_id: teacher.id,
          semester,
          academic_year: academicYear,
          work_rate: parseFloat(pref.work_rate),
          max_periods_per_day: Number(pref.max_periods_per_day),
          unavailable_days: (pref.unavailable_days ?? []).map(Number),
          preferred_periods: (pref.preferred_periods ?? []).map(Number),
          notes: pref.notes ?? '',
        });
      }
    } catch {
      // defaults already set above
    }
  };

  const { data: versions } = useQuery({
    queryKey: ['schedule-versions', period, academicYear],
    queryFn: () => apiClient.get(`/schedule-versions?academicYear=${academicYear}`).then(res => res.data),
    enabled: !!academicYear && (activeTab === '2' || activeTab === '3' || activeTab === '4'),
  });

  const [genForm] = Form.useForm();
  const [taskId, setTaskId] = useState<string | null>(null);
  const [genStatus, setGenStatus] = useState<string>('');

  const generateMutation = useMutation({
    mutationFn: (values: any) => apiClient.post('/schedule/generate', {
        program_id: programId,
        period,
        academic_year: academicYear,
        ...values
    }).then(res => res.data),
    onSuccess: (data) => {
      setTaskId(data.version_id ? null : data.taskId);
      if (data.taskId) {
        setGenStatus('pending');
        message.info('Генерация запущена');
      } else if (data.version_id) {
          message.success('Сгенерировано успешно');
          queryClient.invalidateQueries({ queryKey: ['schedule-versions'] });
      }
    },
  });

   useEffect(() => {
      let interval: any;
      if (taskId && (genStatus === 'pending' || genStatus === 'running')) {
        interval = setInterval(async () => {
          try {
            const res = await apiClient.get(`/schedule/status/${taskId}`);
            const s = res.status || res.data?.status;
            setGenStatus(s);
            if (s === 'done') {
              clearInterval(interval);
              message.success('Генерация завершена');
              setTaskId(null);
              queryClient.invalidateQueries({ queryKey: ['schedule-versions'] });
            } else if (s && s.startsWith('error')) {
              clearInterval(interval);
              message.error('Ошибка: ' + s);
              setTaskId(null);
            }
          } catch (e) {}
        }, 2000);
      }
      return () => clearInterval(interval);
    }, [taskId, genStatus, queryClient]);

  const deleteVersionMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/schedule-versions/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedule-versions'] }),
  });


  // --- Tab 3 logic ---
  const [selectedVersionId, setSelectedVersionId] = useState<string>();
  const [selectedGroupId, setSelectedGroupId] = useState<string>();
  const [weekFilter, setWeekFilter] = useState<'all' | 'odd' | 'even'>('all');
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingSlot, setEditingSlot] = useState<any>(null);
  const [slotForm] = Form.useForm();
  const [activeSlot, setActiveSlot] = useState<any>(null);
  const [pendingMove, setPendingMove] = useState<{ slotId: string; newDay: number; newPeriod: number; conflicts: any[] } | null>(null);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor),
  );

  const getSlotsForCell = (day: number, period: number): any[] => {
    if (!slots) return [];
    return (slots as any[]).filter(s => {
      if (s.day_of_week !== day || s.period_number !== period) return false;
      if (weekFilter !== 'all' && s.week_type !== 'all' && s.week_type !== weekFilter) return false;
      return true;
    });
  };

  const openEditDrawer = (slot: any) => {
    setEditingSlot(slot);
    slotForm.setFieldsValue({
      day_of_week: slot.day_of_week, period: slot.period_number,
      week_type: slot.week_type, classroom_id: slot.classroom?.id,
      override_reason: slot.override_reason,
    });
    setDrawerVisible(true);
  };

  const executeMoveSlot = async (slotId: string, newDay: number, newPeriod: number, force: boolean) => {
    try {
      await apiClient.put(`/schedule-versions/${selectedVersionId}/slots/${slotId}`, {
        day_of_week: newDay,
        period: newPeriod,
        override_reason: 'Ручная корректировка (drag & drop)',
        force,
      });
      message.success('Слот перемещён');
      queryClient.invalidateQueries({ queryKey: ['schedule-slots'] });
      setConflictModalOpen(false);
      setPendingMove(null);
    } catch {
      message.error('Ошибка при сохранении перемещения');
    }
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveSlot((slots as any[])?.find((s: any) => s.id === active.id) ?? null);
  };

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveSlot(null);
    if (!over || !selectedVersionId) return;
    const slotId = active.id as string;
    const parts = (over.id as string).split('-');
    if (parts.length < 3 || parts[0] !== 'cell') return;
    const newDay = Number(parts[1]);
    const newPeriod = Number(parts[2]);
    const slot = (slots as any[])?.find((s: any) => s.id === slotId);
    if (!slot || (slot.day_of_week === newDay && slot.period_number === newPeriod)) return;
    try {
      const res = await apiClient.get(`/schedule-versions/${selectedVersionId}/check-conflict`, {
        params: { slotId, newDay, newPeriod },
      });
      const conflicts: any[] = res.data.conflicts ?? [];
      if (conflicts.length > 0) {
        setPendingMove({ slotId, newDay, newPeriod, conflicts });
        setConflictModalOpen(true);
      } else {
        await executeMoveSlot(slotId, newDay, newPeriod, false);
      }
    } catch {
      message.error('Ошибка при проверке конфликтов');
    }
  };

  const { data: groups } = useQuery({
    queryKey: ['groups', programId],
    queryFn: () => apiClient.get(`/groups?programId=${programId}`).then(res => res.data.data),
    enabled: !!programId,
  });

  const { data: slots } = useQuery({
      queryKey: ['schedule-slots', selectedVersionId, selectedGroupId],
      queryFn: () => apiClient.get(`/schedule-versions/${selectedVersionId}/slots?groupId=${selectedGroupId || ''}`).then(res => res.data),
      enabled: !!selectedVersionId && activeTab === '3',
  });

  const { data: classrooms } = useQuery({
      queryKey: ['classrooms'],
      queryFn: () => apiClient.get('/classrooms').then(res => res.data.data),
  });

  const updateSlotMutation = useMutation({
      mutationFn: (vals: any) => apiClient.put(`/schedule-versions/${selectedVersionId}/slots/${editingSlot.id}`, vals),
      onSuccess: () => {
          message.success('Слот обновлен');
          setDrawerVisible(false);
          queryClient.invalidateQueries({ queryKey: ['schedule-slots'] });
      },
  });

  const publishMutation = useMutation({
      mutationFn: (id: string) => apiClient.post(`/schedule-versions/${id}/publish`),
      onSuccess: () => {
          message.success('Опубликовано!');
          queryClient.invalidateQueries({ queryKey: ['schedule-versions'] });
      }
  });

  // --- Tab 4: Published ---
  const [pubGroupId, setPubGroupId] = useState<string>();
  const [pubWeekFilter, setPubWeekFilter] = useState<'all' | 'odd' | 'even'>('all');

  const publishedVersion = versions?.find((v: any) => v.status === 'published');

  const { data: allGroups } = useQuery({
    queryKey: ['all-groups'],
    queryFn: () => apiClient.get('/groups').then(res => res.data.data),
    enabled: activeTab === '4',
  });

  const { data: pubSlots } = useQuery({
    queryKey: ['pub-slots', publishedVersion?.id, pubGroupId],
    queryFn: () => apiClient.get(`/schedule-versions/${publishedVersion?.id}/slots?groupId=${pubGroupId || ''}`).then(res => res.data),
    enabled: !!publishedVersion?.id && activeTab === '4',
  });

  const getPubSlotsForCell = (day: number, period: number): any[] => {
    if (!pubSlots) return [];
    return (pubSlots as any[]).filter(s => {
      if (s.day_of_week !== day || s.period_number !== period) return false;
      if (pubWeekFilter !== 'all' && s.week_type !== 'all' && s.week_type !== pubWeekFilter) return false;
      return true;
    });
  };


  // --- Renders ---
  const renderContextSelector = () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 24, padding: 16, background: token.colorFillAlter, borderRadius: 8 }}>
      <Select
        placeholder="Институт"
        style={{ width: 200 }}
        value={instituteId}
        onChange={(v) => { setInstituteId(v); setDepartmentId(undefined); setProgramId(undefined); }}
        options={institutes?.map((i: any) => ({ label: i.name, value: i.id }))}
      />
      <Select
        placeholder="Кафедра"
        style={{ width: 250 }}
        value={departmentId}
        onChange={(v) => { setDepartmentId(v); setProgramId(undefined); }}
        disabled={!instituteId}
        options={departments?.map((d: any) => ({ label: d.name, value: d.id }))}
      />
      <Select
        placeholder="Направление"
        style={{ width: 300 }}
        value={programId}
        onChange={setProgramId}
        disabled={!departmentId}
        options={programs?.map((p: any) => ({ label: p.name, value: p.id }))}
      />
      <div style={{ width: '100%' }}></div>
      <Input
        placeholder="Учебный год"
        value={academicYear}
        onChange={e => setAcademicYear(e.target.value)}
        style={{ width: 120 }}
      />
      <Radio.Group value={period} onChange={e => setPeriod(e.target.value)}>
        <Radio.Button value="autumn">Осенний семестр</Radio.Button>
        <Radio.Button value="spring">Весенний семестр</Radio.Button>
      </Radio.Group>
    </div>
  );

  const buildTableRows = (item: any) => {
    const rows: any[] = [];
    const typeCount = [
      item.discipline.hours_lecture > 0,
      item.discipline.hours_practice > 0,
      item.discipline.hours_lab > 0,
    ].filter(Boolean).length;
    let isFirst = true;

    if (item.discipline.hours_lecture > 0) {
      rows.push({ key: `${item.id}-lec`, itemId: item.id, disciplineName: item.discipline.name, rowSpan: isFirst ? typeCount : 0, type: 'lecture', typeLabel: 'Лекции', typeColor: 'blue', hours: item.discipline.hours_lecture, teacher: item.teacher_lecture, classroom: item.classroom_lecture, prefFilled: item.preference_lecture_filled });
      isFirst = false;
    }
    if (item.discipline.hours_practice > 0) {
      rows.push({ key: `${item.id}-pra`, itemId: item.id, disciplineName: isFirst ? item.discipline.name : '', rowSpan: isFirst ? typeCount : 0, type: 'practice', typeLabel: 'Практики', typeColor: 'green', hours: item.discipline.hours_practice, teacher: item.teacher_practice, classroom: item.classroom_practice, prefFilled: item.preference_practice_filled });
      isFirst = false;
    }
    if (item.discipline.hours_lab > 0) {
      rows.push({ key: `${item.id}-lab`, itemId: item.id, disciplineName: isFirst ? item.discipline.name : '', rowSpan: isFirst ? typeCount : 0, type: 'lab', typeLabel: 'Лабораторки', typeColor: 'orange', hours: item.discipline.hours_lab, teacher: item.teacher_lab, classroom: item.classroom_lab, prefFilled: item.preference_lab_filled });
    }
    return rows;
  };

  const renderTab1Data = () => {
    if (!programId || !academicYear || !period) {
      return <Text type="secondary">Выберите направление, год и период.</Text>;
    }
    if (isLoadingDirection) return <Text>Загрузка...</Text>;
    if (!directionData) return <Text>Нет данных</Text>;

    const { readiness, groups: dirGroups, all_teachers } = directionData;
    const totalSlots = readiness.total_lecture_slots + readiness.total_practice_slots + readiness.total_lab_slots;
    const assignedSlots = readiness.assigned_lectures + readiness.assigned_practices + readiness.assigned_labs;

    const tableColumns = (group: any) => [
      {
        title: 'Дисциплина', dataIndex: 'disciplineName', width: '20%',
        onCell: (row: any) => ({ rowSpan: row.rowSpan }),
        render: (name: string) => <Text strong>{name}</Text>,
      },
      {
        title: 'Тип', dataIndex: 'typeLabel', width: '9%',
        render: (label: string, row: any) => <Tag color={row.typeColor}>{label}</Tag>,
      },
      {
        title: 'Часов', dataIndex: 'hours', width: '6%',
        render: (h: number) => <Text type="secondary">{h}ч</Text>,
      },
      {
        title: 'Преподаватель', width: '26%',
        render: (_: any, row: any) => (
          <Select
            style={{ width: '100%' }}
            placeholder="Назначить преподавателя"
            value={row.teacher?.id ?? null}
            allowClear
            showSearch
            optionFilterProp="label"
            onChange={(tid) => handleAssignTeacher(row.itemId, row.type, tid ?? null)}
            options={all_teachers.map((t: any) => ({ value: t.id, label: `${t.last_name} ${t.first_name[0]}.`, department: t.department_name }))}
            optionRender={(opt: any) => (
              <div><div>{opt.data.label}</div><div style={{ fontSize: 11, color: token.colorTextTertiary }}>{opt.data.department}</div></div>
            )}
          />
        ),
      },
      {
        title: 'Аудитория', width: '18%',
        render: (_: any, row: any) => (
          <Input
            placeholder="Номер ауд."
            defaultValue={row.classroom || ''}
            onBlur={(e) => {
              const val = e.target.value.trim();
              if (val !== (row.classroom || '')) {
                handleAssignClassroom(row.itemId, row.type, val || null);
              }
            }}
            onPressEnter={(e) => {
              const val = e.currentTarget.value.trim();
              if (val !== (row.classroom || '')) {
                handleAssignClassroom(row.itemId, row.type, val || null);
                e.currentTarget.blur();
              }
            }}
          />
        ),
      },
      {
        title: 'Пожелания', width: '21%',
        render: (_: any, row: any) => {
          if (!row.teacher) return <Text type="secondary">—</Text>;
          if (row.prefFilled) return (
            <Space size={4}>
              <Tag color="green">✓ Заполнено</Tag>
              <Button size="small" icon={<EyeOutlined />} onClick={() => openPreferenceModal(row.teacher, group.semester, true)} title="Просмотр" />
              <Button size="small" icon={<EditOutlined />} onClick={() => openPreferenceModal(row.teacher, group.semester)} title="Редактировать" />
            </Space>
          );
          return (
            <Button size="small" onClick={() => openPreferenceModal(row.teacher, group.semester)}>
              Заполнить
            </Button>
          );
        },
      },
    ];


    return (
      <>
        <Card title="Статус готовности данных" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
            {dirGroups.map((group: any) => {
              const lec = group.curriculum_items.filter((i: any) => i.discipline.hours_lecture > 0);
              const pra = group.curriculum_items.filter((i: any) => i.discipline.hours_practice > 0);
              const lab = group.curriculum_items.filter((i: any) => i.discipline.hours_lab > 0);
              const assignedLec = lec.filter((i: any) => i.teacher_lecture).length;
              const assignedPra = pra.filter((i: any) => i.teacher_practice).length;
              const assignedLab = lab.filter((i: any) => i.teacher_lab).length;
              const uniqueTeachers = new Set([
                ...lec.filter((i: any) => i.teacher_lecture).map((i: any) => i.teacher_lecture.id),
                ...pra.filter((i: any) => i.teacher_practice).map((i: any) => i.teacher_practice.id),
                ...lab.filter((i: any) => i.teacher_lab).map((i: any) => i.teacher_lab.id),
              ]);
              const prefFilled = [
                ...lec.filter((i: any) => i.preference_lecture_filled),
                ...pra.filter((i: any) => i.preference_practice_filled),
                ...lab.filter((i: any) => i.preference_lab_filled),
              ].length;
              return (
                <div key={group.id}>
                  <Tag color="blue">{group.name} ({group.course} курс, {group.semester} сем)</Tag>
                  Лекции: {assignedLec}/{lec.length} ·{' '}
                  Практики: {assignedPra}/{pra.length} ·{' '}
                  Лабы: {assignedLab}/{lab.length}
                  <span style={{ margin: '0 8px', color: token.colorBorderSecondary }}>|</span>
                  Пожелания: {prefFilled}/{uniqueTeachers.size}
                </div>
              );
            })}
          </div>
          <Divider />
          <Progress
            percent={totalSlots > 0 ? Math.round(assignedSlots / totalSlots * 100) : 0}
            format={() => `${assignedSlots}/${totalSlots} назначено · ${readiness.preferences_filled}/${readiness.preferences_total} пожеланий`}
          />
        </Card>

        <Collapse defaultActiveKey={['0']} accordion={false}>
          {dirGroups.map((group: any, idx: number) => {
            const rows = group.curriculum_items.flatMap(buildTableRows);
            const totalSlotGroup = group.curriculum_items.reduce((s: number, i: any) =>
              s + (i.discipline.hours_lecture > 0 ? 1 : 0) + (i.discipline.hours_practice > 0 ? 1 : 0) + (i.discipline.hours_lab > 0 ? 1 : 0), 0);
            const assignedSlotGroup = rows.filter((r: any) => r.teacher).length;
            return (
              <Collapse.Panel
                key={idx.toString()}
                header={
                  <Space>
                    <Tag color="blue">{group.name}</Tag>
                    <Text type="secondary">{group.course} курс · {group.semester} семестр</Text>
                    <Badge count={`${assignedSlotGroup}/${totalSlotGroup}`} color={assignedSlotGroup === totalSlotGroup ? 'green' : 'orange'} />
                  </Space>
                }
              >
                <Table
                  dataSource={rows}
                  rowKey="key"
                  pagination={false}
                  bordered
                  columns={tableColumns(group)}
                  size="small"
                />
              </Collapse.Panel>
            );
          })}
        </Collapse>
      </>
    );
  };


  const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const periodsList = [1, 2, 3, 4, 5, 6];

  return (
    <div>
      <Title level={2}>Управление расписанием</Title>

      {renderContextSelector()}

      <Tabs activeKey={activeTab} onChange={setActiveTab} type="card">
        
        {/* TAB 1: Data */}
        {hasPermission('schedule.input') && (
          <Tabs.TabPane tab="Данные" key="1">
            {renderTab1Data()}

            <Modal
              title={`${prefViewOnly ? 'Просмотр пожеланий' : 'Пожелания'}: ${selectedTeacher?.last_name} ${selectedTeacher?.first_name}`}
              open={prefModalOpen}
              onCancel={() => setPrefModalOpen(false)}
              onOk={prefViewOnly ? () => setPrefModalOpen(false) : () => prefForm.submit()}
              okText={prefViewOnly ? 'Закрыть' : 'Сохранить'}
              cancelButtonProps={prefViewOnly ? { style: { display: 'none' } } : undefined}
            >
              <Form form={prefForm} layout="vertical" onFinish={vals => savePrefMutation.mutate(vals)}>
                <Form.Item name="teacher_id" hidden><Input /></Form.Item>
                <Form.Item name="semester" hidden><Input /></Form.Item>
                <Form.Item name="academic_year" hidden><Input /></Form.Item>

                <Form.Item name="work_rate" label="Ставка">
                  <Select disabled={prefViewOnly} options={[
                    { value: 0.5, label: '0.5 ставки (≈4-5 пар/нед)' },
                    { value: 0.75, label: '0.75 ставки (≈7 пар/нед)' },
                    { value: 1.0, label: '1.0 ставка (≈9 пар/нед)' },
                    { value: 1.25, label: '1.25 ставки (≈11 пар/нед)' },
                  ]} />
                </Form.Item>

                <Form.Item name="max_periods_per_day" label="Максимум пар в день">
                  <InputNumber min={1} max={6} disabled={prefViewOnly} />
                </Form.Item>

                <Form.Item name="unavailable_days" label="Недоступные дни">
                  <Checkbox.Group disabled={prefViewOnly} options={[
                    { label: 'Пн', value: 1 },
                    { label: 'Вт', value: 2 },
                    { label: 'Ср', value: 3 },
                    { label: 'Чт', value: 4 },
                    { label: 'Пт', value: 5 },
                    { label: 'Сб', value: 6 },
                  ]} />
                </Form.Item>

                <Form.Item name="preferred_periods" label="Предпочтительные пары">
                  <Checkbox.Group disabled={prefViewOnly} options={[
                    { label: '1-я (10:00–11:20)', value: 1 },
                    { label: '2-я (11:30–12:50)', value: 2 },
                    { label: '3-я (13:00–14:20)', value: 3 },
                    { label: '4-я (15:00–16:20)', value: 4 },
                    { label: '5-я (16:30–17:50)', value: 5 },
                    { label: '6-я (18:00–19:20)', value: 6 },
                  ]} />
                </Form.Item>

                <Form.Item name="notes" label="Комментарий">
                  <Input.TextArea rows={2} placeholder="Дополнительные пожелания..." disabled={prefViewOnly} />
                </Form.Item>
              </Form>
            </Modal>
          </Tabs.TabPane>
        )}

        {/* TAB 2: Generation */}
        {hasPermission('schedule.generate') && (
          <Tabs.TabPane tab="Генерация" key="2">
            {!academicYear ? (
              <Text type="secondary">Укажите учебный год и период.</Text>
            ) : (
              <>
                <Card title="Параметры генерации" style={{ marginBottom: 24 }}>
                  <Form form={genForm} layout="vertical" onFinish={(vals) => generateMutation.mutate(vals)} initialValues={{
                      version_name: `Вариант ${versions ? versions.length + 1 : 1}`,
                  }}>
                  <div style={{ marginBottom: 16, padding: '10px 14px', background: token.colorInfoBg, border: `1px solid ${token.colorInfoBorder}`, borderRadius: 6 }}>
                      <Text strong>Период генерации: </Text>
                      <Tag color={period === 'autumn' ? 'orange' : 'blue'} style={{ marginLeft: 4 }}>
                        {period === 'autumn' ? 'Осенний семестр' : 'Весенний семестр'}
                      </Tag>
                      <Tag color="default">{academicYear}</Tag>
                      <div style={{ marginTop: 4 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>Генерация охватывает весь университет — все группы, все аудитории, все преподаватели</Text>
                      </div>
                  </div>

                    <Form.Item name="version_name" label="Название варианта">
                      <Input />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" loading={generateMutation.isPending || !!taskId}>Запустить генерацию</Button>
                  </Form>

                  {taskId && (
                    <div style={{ marginTop: 24 }}>
                      <Text>Статус: {genStatus}</Text>
                      <Progress percent={genStatus === 'done' ? 100 : genStatus === 'running' ? 50 : 10} status={genStatus.startsWith('error') ? 'exception' : 'active'} />
                    </div>
                  )}
                </Card>

                <Card title="Сохраненные варианты">
                  <Table
                    dataSource={versions || []}
                    rowKey="id"
                    pagination={false}
                    columns={[
                      { title: 'Название', dataIndex: 'name' },
                      { title: 'Качество', dataIndex: 'quality_score', render: (val: number) => <Progress percent={val} steps={10} size="small" strokeColor={val > 80 ? '#52c41a' : val > 50 ? '#faad14' : '#f5222d'} format={() => `${val}/100`} /> },
                      { title: 'Статус', dataIndex: 'status', render: (val: string) => val === 'published' ? <Tag color="green">Опубликован</Tag> : <Tag color="default">Черновик</Tag> },
                      {
                        title: 'Действия',
                        render: (_: any, r: any) => (
                            <Space>
                                <Button size="small" onClick={() => {
                                    setSelectedVersionId(r.id);
                                    setActiveTab('3');
                                }}>Просмотр</Button>
                                <Popconfirm
                                  title={r.status === 'published' ? 'Удалить опубликованное расписание?' : 'Удалить вариант?'}
                                  description={r.status === 'published' ? 'Студенты и преподаватели потеряют доступ к расписанию.' : undefined}
                                  okType={r.status === 'published' ? 'danger' : 'primary'}
                                  onConfirm={() => deleteVersionMutation.mutate(r.id)}
                                >
                                    <Button danger size="small" icon={<DeleteOutlined />} />
                                </Popconfirm>
                            </Space>
                        )
                      }
                    ]}
                  />
                </Card>
              </>
            )}
          </Tabs.TabPane>
        )}

        {/* TAB 3: Drag & Drop Edit */}
        {hasPermission('schedule.edit') && (
          <Tabs.TabPane tab="Просмотр и корректировка" key="3">
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, padding: 16, background: token.colorFillAlter, borderRadius: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Select
                placeholder="Вариант расписания"
                style={{ width: 300 }}
                value={selectedVersionId}
                onChange={setSelectedVersionId}
                options={versions?.map((v: any) => ({ label: `${v.name} (${v.quality_score}/100) ${v.status === 'published' ? '★' : ''}`, value: v.id }))}
              />
              <Select
                placeholder="Группа (фильтр)"
                style={{ width: 180 }}
                value={selectedGroupId}
                onChange={setSelectedGroupId}
                allowClear
                options={groups?.map((g: any) => ({ label: g.name, value: g.id }))}
              />
              <Radio.Group value={weekFilter} onChange={e => setWeekFilter(e.target.value)} buttonStyle="solid" size="small">
                <Radio.Button value="all">Все недели</Radio.Button>
                <Radio.Button value="odd">Нечётная</Radio.Button>
                <Radio.Button value="even">Чётная</Radio.Button>
              </Radio.Group>
              <div style={{ flex: 1 }} />
              <Button
                type="primary"
                disabled={!selectedVersionId || versions?.find((v: any) => v.id === selectedVersionId)?.status === 'published' || !hasPermission('schedule.publish')}
                onClick={() => publishMutation.mutate(selectedVersionId!)}
              >
                Опубликовать
              </Button>
            </div>

            {!selectedVersionId ? (
              <Text type="secondary">Выберите вариант расписания.</Text>
            ) : (
              <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <thead>
                      <tr>
                        <th style={{ border: `1px solid ${token.colorBorderSecondary}`, padding: 8, background: token.colorFillAlter, width: 58, textAlign: 'center' }}>Пара</th>
                        {days.map(d => (
                          <th key={d} style={{ border: `1px solid ${token.colorBorderSecondary}`, padding: 8, background: token.colorFillAlter, textAlign: 'center' }}>{d}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {periodsList.map(p => (
                        <tr key={p}>
                          <td style={{ border: `1px solid ${token.colorBorderSecondary}`, padding: '6px 4px', textAlign: 'center', background: token.colorFillAlter, width: 58 }}>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{p}</div>
                            <div style={{ fontSize: 10, color: token.colorTextDisabled }}>{PERIOD_TIMES[p]}</div>
                          </td>
                          {days.map((_d, dIdx) => {
                            const cellSlots = getSlotsForCell(dIdx + 1, p);
                            return (
                              <DroppableCell key={dIdx} day={dIdx + 1} period={p}>
                                {cellSlots.map((slot: any) => (
                                  <DraggableLesson key={slot.id} slot={slot} onEdit={openEditDrawer} />
                                ))}
                              </DroppableCell>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <DragOverlay dropAnimation={null}>
                  {activeSlot && (
                    <div style={{ width: 160, boxShadow: '0 4px 16px rgba(0,0,0,0.18)', borderRadius: 4, opacity: 0.95 }}>
                      <LessonCard slot={activeSlot} />
                    </div>
                  )}
                </DragOverlay>
              </DndContext>
            )}

            {/* Conflict resolution modal */}
            <Modal
              title="Конфликт расписания"
              open={conflictModalOpen}
              onCancel={() => { setConflictModalOpen(false); setPendingMove(null); }}
              footer={[
                <Button key="cancel" onClick={() => { setConflictModalOpen(false); setPendingMove(null); }}>
                  Отмена
                </Button>,
                <Button
                  key="force"
                  type="primary"
                  danger
                  onClick={() => pendingMove && executeMoveSlot(pendingMove.slotId, pendingMove.newDay, pendingMove.newPeriod, true)}
                >
                  Всё равно сохранить (зафиксировать конфликт)
                </Button>,
              ]}
            >
              <Text strong>Обнаружены конфликты:</Text>
              <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                {pendingMove?.conflicts.map((c: any, i: number) => (
                  <li key={i} style={{ color: c.type === 'teacher' ? token.colorPrimary : c.type === 'classroom' ? token.colorWarning : token.colorError, marginBottom: 4 }}>
                    {c.message}
                  </li>
                ))}
              </ul>
            </Modal>

            {/* Drawer for fine-grained slot editing */}
            <Drawer title="Редактирование слота" placement="right" onClose={() => setDrawerVisible(false)} open={drawerVisible} styles={{ wrapper: { width: 400 } }}>
              {editingSlot && (
                <Form form={slotForm} layout="vertical" onFinish={(vals) => updateSlotMutation.mutate(vals)}>
                  <div style={{ marginBottom: 16, padding: 12, background: token.colorFillAlter, borderRadius: 6 }}>
                    <div style={{ fontWeight: 'bold' }}>{editingSlot.discipline?.name}</div>
                    <div>Группа: {editingSlot.group?.name}</div>
                    <div>Преподаватель: {editingSlot.teacher?.first_name} {editingSlot.teacher?.last_name}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <Form.Item name="day_of_week" label="День недели">
                      <Select options={days.map((d, i) => ({ label: d, value: i + 1 }))} />
                    </Form.Item>
                    <Form.Item name="period" label="Пара">
                      <Select options={periodsList.map(p => ({ label: p, value: p }))} />
                    </Form.Item>
                  </div>
                  <Form.Item name="week_type" label="Неделя">
                    <Select options={[{ label: 'Все', value: 'all' }, { label: 'Нечетная', value: 'odd' }, { label: 'Четная', value: 'even' }]} />
                  </Form.Item>
                  <Form.Item name="classroom_id" label="Аудитория">
                    <Select options={classrooms?.map((c: any) => ({ label: `${c.number}`, value: c.id }))} />
                  </Form.Item>
                  <Form.Item name="override_reason" label="Причина изменения" rules={[{ required: true }]}>
                    <Input.TextArea />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" block loading={updateSlotMutation.isPending}>Сохранить</Button>
                </Form>
              )}
            </Drawer>
          </Tabs.TabPane>
        )}

        {/* TAB 4: Published */}
        <Tabs.TabPane tab="Опубликованное" key="4">
          {!publishedVersion ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <Title level={4}>Нет опубликованного расписания</Title>
              <Text type="secondary">Опубликуйте один из вариантов во вкладке «Просмотр и корректировка».</Text>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, padding: 16, background: token.colorFillAlter, borderRadius: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Tag color="green" style={{ fontSize: 13, padding: '4px 10px' }}>★ {publishedVersion.name}</Tag>
                <Select
                  placeholder="Группа (фильтр)"
                  style={{ width: 180 }}
                  value={pubGroupId}
                  onChange={setPubGroupId}
                  allowClear
                  options={allGroups?.map((g: any) => ({ label: g.name, value: g.id }))}
                />
                <Radio.Group value={pubWeekFilter} onChange={e => setPubWeekFilter(e.target.value)} buttonStyle="solid" size="small">
                  <Radio.Button value="all">Все недели</Radio.Button>
                  <Radio.Button value="odd">Нечётная</Radio.Button>
                  <Radio.Button value="even">Чётная</Radio.Button>
                </Radio.Group>
              </div>

              {!pubGroupId ? (
                <div style={{ padding: '24px 0', textAlign: 'center' }}>
                  <Text type="secondary">Выберите группу для просмотра расписания.</Text>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <thead>
                      <tr>
                        <th style={{ border: `1px solid ${token.colorBorderSecondary}`, padding: 8, background: token.colorFillAlter, width: 58, textAlign: 'center' }}>Пара</th>
                        {days.map(d => (
                          <th key={d} style={{ border: `1px solid ${token.colorBorderSecondary}`, padding: 8, background: token.colorFillAlter, textAlign: 'center' }}>{d}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {periodsList.map(p => (
                        <tr key={p}>
                          <td style={{ border: `1px solid ${token.colorBorderSecondary}`, padding: '6px 4px', textAlign: 'center', background: token.colorFillAlter, width: 58 }}>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{p}</div>
                            <div style={{ fontSize: 10, color: token.colorTextDisabled }}>{PERIOD_TIMES[p]}</div>
                          </td>
                          {days.map((_d, dIdx) => {
                            const cellSlots = getPubSlotsForCell(dIdx + 1, p);
                            return (
                              <td
                                key={dIdx}
                                style={{ border: '1px solid #f0f0f0', padding: '4px 6px', verticalAlign: 'top', minHeight: 88, width: '16%' }}
                              >
                                {cellSlots.length === 0
                                  ? <div style={{ minHeight: 60, color: token.colorTextDisabled, textAlign: 'center', paddingTop: 22, fontSize: 11 }}>—</div>
                                  : cellSlots.map((slot: any) => (
                                    <div key={slot.id} style={{ marginBottom: 4 }}>
                                      <LessonCard slot={slot} />
                                    </div>
                                  ))
                                }
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
};
