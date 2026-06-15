import React, { useState, useEffect } from 'react';
import { Select, Space } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/api.client';

interface Props {
  onChange: (selection: { instituteId?: string; departmentId?: string; programId?: string; groupId?: string }) => void;
  levels: ('institute' | 'department' | 'program' | 'group')[];
  initialValues?: { instituteId?: string; departmentId?: string; programId?: string; groupId?: string };
}

export const HierarchyFilter: React.FC<Props> = ({ onChange, levels, initialValues }) => {
  const [instituteId, setInstituteId] = useState<string | undefined>(initialValues?.instituteId);
  const [departmentId, setDepartmentId] = useState<string | undefined>(initialValues?.departmentId);
  const [programId, setProgramId] = useState<string | undefined>(initialValues?.programId);
  const [groupId, setGroupId] = useState<string | undefined>(initialValues?.groupId);

  useEffect(() => {
    onChange({ instituteId, departmentId, programId, groupId });
  }, [instituteId, departmentId, programId, groupId]);

  const { data: institutes, isLoading: instLoad } = useQuery({
    queryKey: ['institutes'],
    queryFn: () => apiClient.get('/institutes').then(res => res.data.data),
    enabled: levels.includes('institute')
  });

  const { data: departments, isLoading: depLoad } = useQuery({
    queryKey: ['departments', instituteId],
    queryFn: () => apiClient.get(`/departments?instituteId=${instituteId}`).then(res => res.data.data),
    enabled: levels.includes('department') && !!instituteId
  });

  const { data: programs, isLoading: progLoad } = useQuery({
    queryKey: ['programs', departmentId],
    queryFn: () => apiClient.get(`/programs?departmentId=${departmentId}`).then(res => res.data.data),
    enabled: levels.includes('program') && !!departmentId
  });

  const { data: groups, isLoading: grpLoad } = useQuery({
    queryKey: ['groups', programId],
    queryFn: () => apiClient.get(`/groups?programId=${programId}`).then(res => res.data.data),
    enabled: levels.includes('group') && !!programId
  });

  return (
    <Space wrap style={{ marginBottom: 16 }}>
      {levels.includes('institute') && (
        <Select
          style={{ width: 250 }}
          placeholder="Выберите институт"
          loading={instLoad}
          allowClear
          value={instituteId}
          options={institutes?.map((i: any) => ({ value: i.id, label: i.name }))}
          onChange={(val) => { setInstituteId(val); setDepartmentId(undefined); setProgramId(undefined); setGroupId(undefined); }}
        />
      )}
      {levels.includes('department') && (
        <Select
          style={{ width: 250 }}
          placeholder="Выберите кафедру"
          loading={depLoad}
          allowClear
          value={departmentId}
          disabled={!instituteId}
          options={departments?.map((d: any) => ({ value: d.id, label: d.name }))}
          onChange={(val) => { setDepartmentId(val); setProgramId(undefined); setGroupId(undefined); }}
        />
      )}
      {levels.includes('program') && (
        <Select
          style={{ width: 250 }}
          placeholder="Выберите направление"
          loading={progLoad}
          allowClear
          value={programId}
          disabled={!departmentId}
          options={programs?.map((p: any) => ({ value: p.id, label: p.name }))}
          onChange={(val) => { setProgramId(val); setGroupId(undefined); }}
        />
      )}
      {levels.includes('group') && (
        <Select
          style={{ width: 150 }}
          placeholder="Выберите группу"
          loading={grpLoad}
          allowClear
          value={groupId}
          disabled={!programId}
          options={groups?.map((g: any) => ({ value: g.id, label: g.name }))}
          onChange={(val) => setGroupId(val)}
        />
      )}
    </Space>
  );
};
