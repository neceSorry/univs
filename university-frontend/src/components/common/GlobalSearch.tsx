import React, { useState, useCallback } from 'react';
import { AutoComplete, Input } from 'antd';
import { SearchOutlined, UserOutlined, TeamOutlined, BookOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/api.client';
import { useAuthStore } from '../../store/auth.store';

interface SearchResult {
  value: string;
  label: React.ReactNode;
  path?: string;
  disabled?: boolean;
}

const highlight = (text: string, query: string) => {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, idx)}
      <strong style={{ fontWeight: 700 }}>{text.slice(idx, idx + query.length)}</strong>
      {text.slice(idx + query.length)}
    </span>
  );
};

export const GlobalSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const role = useAuthStore(s => s.role);

  const enabled = query.trim().length >= 2;

  const { data: students } = useQuery({
    queryKey: ['search-students'],
    queryFn: () => apiClient.get('/students').then(r => r.data.data ?? []),
    staleTime: 60_000,
    enabled: role === 'admin' || role === 'teacher',
  });

  const { data: teachers } = useQuery({
    queryKey: ['search-teachers'],
    queryFn: () => apiClient.get('/teachers').then(r => r.data.data ?? []),
    staleTime: 60_000,
    enabled: role === 'admin',
  });

  const { data: groups } = useQuery({
    queryKey: ['search-groups'],
    queryFn: () => apiClient.get('/groups').then(r => r.data.data ?? []),
    staleTime: 60_000,
    enabled: role === 'admin',
  });

  const buildOptions = useCallback(() => {
    if (!enabled) return [];
    const q = query.toLowerCase();

    const studentResults: SearchResult[] = (students ?? [])
      .filter((s: any) => {
        const full = `${s.last_name} ${s.first_name} ${s.middle_name ?? ''}`.toLowerCase();
        return full.includes(q);
      })
      .slice(0, 5)
      .map((s: any) => {
        // Teacher → grade journal for student's group; Admin → students page
        const path = role === 'teacher'
          ? `/teacher/groups?groupId=${s.group?.id}`
          : '/admin/students';
        return {
          value: `student-${s.id}`,
          path,
          label: (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserOutlined style={{ opacity: 0.45 }} />
              {highlight(`${s.last_name} ${s.first_name} ${s.middle_name ?? ''}`.trim(), query)}
              <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.45 }}>Студент</span>
            </div>
          ),
        };
      });

    const teacherResults: SearchResult[] = (teachers ?? [])
      .filter((t: any) => {
        const full = `${t.last_name} ${t.first_name} ${t.middle_name ?? ''}`.toLowerCase();
        return full.includes(q);
      })
      .slice(0, 5)
      .map((t: any) => ({
        value: `teacher-${t.id}`,
        path: '/admin/teachers',
        label: (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOutlined style={{ opacity: 0.45 }} />
            {highlight(`${t.last_name} ${t.first_name} ${t.middle_name ?? ''}`.trim(), query)}
            <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.45 }}>Преподаватель</span>
          </div>
        ),
      }));

    const groupResults: SearchResult[] = (groups ?? [])
      .filter((g: any) => g.name?.toLowerCase().includes(q))
      .slice(0, 5)
      .map((g: any) => ({
        value: `group-${g.id}`,
        path: '/admin/groups',
        label: (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TeamOutlined style={{ opacity: 0.45 }} />
            {highlight(g.name, query)}
            <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.45 }}>Группа</span>
          </div>
        ),
      }));

    const all = [...studentResults, ...teacherResults, ...groupResults];
    if (all.length === 0) {
      return [{ value: '__empty__', label: <span style={{ opacity: 0.45 }}>Ничего не найдено</span>, disabled: true }];
    }
    return all;
  }, [query, students, teachers, groups, enabled, role]);

  const options = buildOptions();

  return (
    <AutoComplete
      style={{ width: 240 }}
      options={options}
      value={query}
      onChange={setQuery}
      onSelect={(val: string) => {
        const found = options.find(o => o.value === val) as SearchResult | undefined;
        if (found?.path) {
          navigate(found.path);
        }
        setQuery('');
      }}
    >
      <Input
        prefix={<SearchOutlined style={{ opacity: 0.45 }} />}
        placeholder="Поиск..."
        allowClear
        style={{ borderRadius: 6 }}
      />
    </AutoComplete>
  );
};
