import React, { useState, useEffect, useCallback } from 'react';
import { Table, Select, Space, Input, Popover, Button, Typography, message } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../../api/api.client';

const { Text } = Typography;

// Generate last N weekdays: returns [{iso: 'YYYY-MM-DD', label: 'DD.MM'}]
const generateLessonDates = (count = 10) => {
  const result: { iso: string; label: string }[] = [];
  const d = new Date();
  while (result.length < count) {
    d.setDate(d.getDate() - 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      const iso = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
      result.unshift({ iso, label });
    }
  }
  return result;
};

const DATES = generateLessonDates(10);

interface CellProps {
  value: string;
  onChange: (v: string) => void;
}

const GradeCell: React.FC<CellProps> = ({ value, onChange }) => {
  const [inputVal, setInputVal] = useState('');
  const [open, setOpen] = useState(false);

  const handleClick = () => {
    if (value === '') {
      onChange('+');
    } else if (value === '+') {
      setInputVal('');
      setOpen(true);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Text type="secondary" style={{ fontSize: 12 }}>Доп. балл (1–10)</Text>
      <Space>
        <Input
          size="small"
          style={{ width: 60 }}
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onPressEnter={() => {
            const n = Number(inputVal);
            if (n >= 1 && n <= 10) { onChange(String(n)); setOpen(false); }
          }}
          autoFocus
        />
        <Button size="small" type="primary" onClick={() => {
          const n = Number(inputVal);
          if (n >= 1 && n <= 10) { onChange(String(n)); setOpen(false); }
        }}>ОК</Button>
        <Button size="small" onClick={() => setOpen(false)}>✕</Button>
      </Space>
    </div>
  );

  return (
    <Popover content={content} open={open} onOpenChange={setOpen} trigger="click">
      <div
        onClick={handleClick}
        style={{
          minWidth: 32,
          minHeight: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          borderRadius: 4,
          fontSize: 13,
          fontWeight: 600,
          background: value === '+' ? 'rgba(82,196,26,0.15)' : value ? 'rgba(22,119,255,0.15)' : undefined,
          color: value === '+' ? '#52c41a' : value ? '#1677ff' : 'rgba(255,255,255,0.2)',
          border: value ? '1px solid transparent' : '1px dashed rgba(255,255,255,0.1)',
          position: 'relative',
        }}
      >
        {value || '·'}
        {value && (
          <span
            onClick={handleClear}
            style={{
              position: 'absolute',
              top: -6,
              right: -6,
              fontSize: 10,
              color: 'rgba(255,255,255,0.3)',
              lineHeight: 1,
            }}
          >
            ×
          </span>
        )}
      </div>
    </Popover>
  );
};

export const GradeBookPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [groupId, setGroupId] = useState<string | undefined>(searchParams.get('groupId') ?? undefined);
  const [disciplineId, setDisciplineId] = useState<string | undefined>(searchParams.get('disciplineId') ?? undefined);

  // grades[studentId][isoDate] = '' | '+' | '1'-'10'
  const [grades, setGrades] = useState<Record<string, Record<string, string>>>({});
  // finalGrades[studentId] = number string | ''
  const [finalGrades, setFinalGrades] = useState<Record<string, string>>({});

const { data: groups } = useQuery({
    queryKey: ['teacher-groups'],
    queryFn: () => apiClient.get('/teacher/my-groups').then(res => res.data.data),
  });

  const { data: disciplines } = useQuery({
    queryKey: ['teacher-disciplines'],
    queryFn: () => apiClient.get('/teacher/my-disciplines').then(res => res.data.data),
  });

  const { data: students, isLoading: loadingStudents } = useQuery({
    queryKey: ['group-students', groupId],
    queryFn: () => apiClient.get(`/teacher/my-groups/${groupId}/students`).then(res => res.data.data),
    enabled: !!groupId,
  });

  // Load journal entries whenever group+discipline change
  useEffect(() => {
    if (!groupId || !disciplineId) return;
    apiClient.get('/teacher/journal', { params: { groupId, disciplineId } }).then(res => {
      const entries: any[] = res.data.data ?? [];
      const newGrades: Record<string, Record<string, string>> = {};
      const newFinal: Record<string, string> = {};
      for (const e of entries) {
        if (e.lesson_date === null) {
          newFinal[e.student_id] = e.value;
        } else {
          if (!newGrades[e.student_id]) newGrades[e.student_id] = {};
          newGrades[e.student_id][e.lesson_date] = e.value;
        }
      }
      setGrades(newGrades);
      setFinalGrades(newFinal);
    });
  }, [groupId, disciplineId]);

  useEffect(() => {
    if (!disciplineId && disciplines?.length > 0) {
      setDisciplineId(disciplines[0].id);
    }
  }, [disciplines, disciplineId]);

  const [saving, setSaving] = useState(false);

  const setGrade = useCallback((studentId: string, isoDate: string, value: string) => {
    setGrades(prev => ({
      ...prev,
      [studentId]: { ...(prev[studentId] ?? {}), [isoDate]: value },
    }));
  }, []);

  const setFinalGrade = useCallback((studentId: string, value: string) => {
    setFinalGrades(prev => ({ ...prev, [studentId]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!groupId || !disciplineId) return;
    const entries: any[] = [];
    for (const [studentId, datemap] of Object.entries(grades)) {
      for (const [lesson_date, value] of Object.entries(datemap)) {
        entries.push({ student_id: studentId, discipline_id: disciplineId, group_id: groupId, lesson_date, value });
      }
    }
    for (const [studentId, value] of Object.entries(finalGrades)) {
      entries.push({ student_id: studentId, discipline_id: disciplineId, group_id: groupId, lesson_date: null, value });
    }
    if (entries.length === 0) { message.info('Нечего сохранять'); return; }
    setSaving(true);
    try {
      await apiClient.post('/teacher/journal/save', { groupId, disciplineId, entries });
      message.success('Журнал сохранён');
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Ошибка при сохранении';
      message.error(`Ошибка: ${JSON.stringify(msg)}`);
      console.error('saveJournal error', err?.response?.data ?? err);
    } finally {
      setSaving(false);
    }
  }, [groupId, disciplineId, grades, finalGrades]);

  const dateColumns = DATES.map(({ iso, label }) => ({
    title: <span style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{label}</span>,
    key: iso,
    width: 52,
    align: 'center' as const,
    render: (_: any, row: any) => (
      <GradeCell
        value={grades[row.id]?.[iso] ?? ''}
        onChange={v => setGrade(row.id, iso, v)}
      />
    ),
  }));

  const columns = [
    {
      title: 'ФИО Студента',
      key: 'name',
      fixed: 'left' as const,
      width: 220,
      render: (_: any, r: any) => `${r.last_name} ${r.first_name}`,
    },
    ...dateColumns,
    {
      title: 'Итог. балл',
      key: 'final',
      width: 100,
      align: 'center' as const,
      fixed: 'right' as const,
      render: (_: any, r: any) => (
        <Input
          size="small"
          style={{ width: 70, textAlign: 'center' }}
          placeholder="0"
          value={finalGrades[r.id] ?? ''}
          onChange={e => {
            const v = e.target.value;
            if (v === '' || /^\d{0,3}$/.test(v)) {
              setFinalGrade(r.id, v);
            }
          }}
        />
      ),
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Журнал</h2>
      <Space style={{ marginBottom: 16 }}>
        <Select
          style={{ width: 180 }}
          placeholder="Группа"
          value={groupId}
          options={groups?.map((g: any) => ({ label: g.name, value: g.id }))}
          onChange={v => { setGroupId(v); setGrades({}); setFinalGrades({}); }}
        />
        <Select
          style={{ width: 220 }}
          placeholder="Дисциплина"
          value={disciplineId}
          options={disciplines?.map((d: any) => ({ label: d.name, value: d.id }))}
          onChange={v => { setDisciplineId(v); setGrades({}); setFinalGrades({}); }}
        />
        <Button type="primary" loading={saving} onClick={handleSave} disabled={!groupId || !disciplineId}>
          Сохранить
        </Button>
      </Space>

      <Table
        columns={columns}
        dataSource={students || []}
        rowKey="id"
        loading={loadingStudents}
        scroll={{ x: 'max-content' }}
        pagination={false}
        bordered
        size="small"
      />
    </div>
  );
};
