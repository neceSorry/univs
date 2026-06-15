import React from 'react';
import { Upload, Button, List, Card, message, Typography, Popconfirm } from 'antd';
import { InboxOutlined, FileOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../../api/api.client';
import dayjs from 'dayjs';

const { Dragger } = Upload;
const { Title } = Typography;

export const MaterialsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const itemId = searchParams.get('itemId');
  const queryClient = useQueryClient();

  const { data: materials, isLoading } = useQuery({
    queryKey: ['materials', itemId],
    queryFn: () => apiClient.get(`/materials?curriculumItemId=${itemId}`).then(res => res.data.data),
    enabled: !!itemId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/materials/${id}`),
    onSuccess: () => {
      message.success('Файл удален');
      queryClient.invalidateQueries({ queryKey: ['materials'] });
    }
  });

  const uploadProps = {
    name: 'file',
    multiple: false,
    action: 'http://localhost:3000/materials/upload',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('access_token')}`
    },
    data: { curriculumItemId: itemId },
    onChange(info: any) {
      const { status } = info.file;
      if (status === 'done') {
        message.success(`${info.file.name} успешно загружен.`);
        queryClient.invalidateQueries({ queryKey: ['materials'] });
      } else if (status === 'error') {
        message.error(`${info.file.name} ошибка загрузки.`);
      }
    },
  };

  if (!itemId) return <Title level={4}>Выберите предмет из раздела "Мои дисциплины"</Title>;

  return (
    <div>
      <Title level={2}>Учебные материалы</Title>
      
      <Card style={{ marginBottom: 24 }}>
        <Dragger {...uploadProps}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">Нажмите или перетащите файл для загрузки</p>
          <p className="ant-upload-hint">Поддерживаются PDF, DOCX, PPTX и другие форматы</p>
        </Dragger>
      </Card>

      <List
        loading={isLoading}
        grid={{ gutter: 16, column: 4 }}
        dataSource={materials || []}
        renderItem={(item: any) => (
          <List.Item>
            <Card
              hoverable
              actions={[
                <Popconfirm title="Удалить файл?" onConfirm={() => deleteMutation.mutate(item.id)}>
                  <Button type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              ]}
            >
              <Card.Meta
                avatar={<FileOutlined style={{ fontSize: 32, color: '#1890ff' }} />}
                title={<a href={`http://localhost:3000${item.file_url}`} target="_blank" rel="noreferrer">{item.title}</a>}
                description={dayjs(item.uploaded_at).format('DD.MM.YYYY HH:mm')}
              />
            </Card>
          </List.Item>
        )}
      />
    </div>
  );
};
