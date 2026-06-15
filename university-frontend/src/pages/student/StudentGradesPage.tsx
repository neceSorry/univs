import React from 'react';
import { Table, Card, Typography, Tag, Spin } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/api.client';

const { Title, Text } = Typography;

function gradeText(score: number): string {
  if (score >= 90) return 'Отл';
  if (score >= 75) return 'Хор';
  if (score >= 55) return 'Удов';
  return 'Неуд';
}

export const StudentGradesPage: React.FC = () => {
  const { data: gradesData, isLoading: gradesLoading } = useQuery({
    queryKey: ['my-grades'],
    queryFn: () => apiClient.get('/student/my-grades').then(res => res.data),
  });

  const { data: curriculumData, isLoading: curriculumLoading } = useQuery({
    queryKey: ['my-curriculum'],
    queryFn: () => apiClient.get('/student/my-curriculum').then(res => res.data),
  });

  if (gradesLoading || curriculumLoading) return <Spin style={{ display: 'block', marginTop: 48 }} />;

  const grades: any[] = gradesData?.data ?? [];
  const curriculumDisciplines: any[] = curriculumData?.data ?? [];

  // Map discipline id → grade record
  const gradeByDisciplineId = new Map<string, any>();
  for (const g of grades) {
    const dId = g.discipline?.id ?? g.slot?.discipline?.id;
    if (dId) gradeByDisciplineId.set(dId, g);
  }

  // Group by semester
  const bySemester = new Map<number, any[]>();
  for (const d of curriculumDisciplines) {
    const sem = d.semester ?? 0;
    if (!bySemester.has(sem)) bySemester.set(sem, []);
    bySemester.get(sem)!.push({ ...d, grade: gradeByDisciplineId.get(d.id) ?? null });
  }
  const sortedSemesters = Array.from(bySemester.keys()).sort((a, b) => a - b);

  const columns = [
    {
      title: 'Предмет',
      dataIndex: 'name',
      key: 'name',
      render: (v: string) => <Text style={{ fontSize: 14 }}>{v}</Text>,
    },
    {
      title: 'Кредиты',
      dataIndex: 'credits',
      key: 'credits',
      width: 90,
      render: (v: number) => <Text type="secondary">{v ?? '—'}</Text>,
    },
    {
      title: 'Балл',
      key: 'score',
      width: 70,
      render: (_: any, r: any) =>
        r.grade ? (
          <Text strong style={{ fontSize: 14 }}>{Number(r.grade.grade_value)}</Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Оценка',
      key: 'label',
      width: 80,
      render: (_: any, r: any) =>
        r.grade ? (
          <Tag style={{ fontSize: 11 }}>{gradeText(Number(r.grade.grade_value))}</Tag>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Дата',
      key: 'date',
      width: 110,
      render: (_: any, r: any) => (
        <Text type="secondary" style={{ fontSize: 11 }}>
          {r.grade?.graded_at ? new Date(r.grade.graded_at).toLocaleDateString('ru-RU') : '—'}
        </Text>
      ),
    },
  ];

  return (
    <div>
      <Title level={2}>Оценки</Title>
      {sortedSemesters.map(sem => {
        const rows = bySemester.get(sem) ?? [];
        const totalCredits = rows.reduce((sum, r) => sum + (r.credits ?? 0), 0);
        return (
          <Card
            key={sem}
            title={
              <span>
                {sem ? `Семестр ${sem}` : 'Без семестра'}
                <Text type="secondary" style={{ fontWeight: 400, marginLeft: 16, fontSize: 13 }}>
                  Всего кредитов: <Text strong>{totalCredits}</Text>
                </Text>
              </span>
            }
            style={{ marginBottom: 16 }}
            styles={{ header: { fontWeight: 600 } }}
          >
            <Table
              size="small"
              pagination={false}
              rowKey="id"
              dataSource={rows}
              columns={columns}
              showHeader={sem === sortedSemesters[0]}
            />
          </Card>
        );
      })}
    </div>
  );
};
