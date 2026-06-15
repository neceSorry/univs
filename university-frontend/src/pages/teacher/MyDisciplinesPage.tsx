import React from 'react';
import { Card, Row, Col, Typography, Button } from 'antd';
import { BookOutlined, RightOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/api.client';

const { Title } = Typography;

export const MyDisciplinesPage: React.FC = () => {
  const navigate = useNavigate();
  
  const { data: disciplines } = useQuery({
    queryKey: ['teacher-disciplines'],
    queryFn: () => apiClient.get('/teacher/my-disciplines').then(res => res.data.data),
  });

  return (
    <div>
      <Title level={2}>Мои дисциплины</Title>
      <Row gutter={[16, 16]}>
        {disciplines?.map((d: any) => (
          <Col span={8} key={d.id}>
            <Card 
              hoverable 
              style={{ height: '100%' }}
              actions={[
                <Button type="link" onClick={() => navigate(`/teacher/groups?disciplineId=${d.id}`)}>
                  Журнал <RightOutlined />
                </Button>,
              ]}
            >
              <Card.Meta
                avatar={<BookOutlined style={{ fontSize: 24, color: '#1890ff' }} />}
                title={<span style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{d.name}</span>}
                description={null}
              />
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};
