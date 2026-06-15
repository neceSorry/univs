import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/api.client';
import { useAuthStore } from '../../store/auth.store';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';

const { Title } = Typography;

const loginSchema = z.object({
  username: z.string().min(1, 'Введите логин'),
  password: z.string().min(6, 'Пароль должен быть не менее 6 символов'),
});

type LoginFormInputs = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [loading, setLoading] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<LoginFormInputs>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormInputs) => {
    setLoading(true);
    try {
      const response = await apiClient.post('/auth/login', data);
      login(response.data);
      
      const role = response.data.user.role;
      if (role === 'admin') navigate('/admin');
      else if (role === 'teacher') navigate('/teacher');
      else if (role === 'student') navigate('/student');
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: '#1a2035',
    borderColor: '#2d3a55',
    color: '#e0e6f0',
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0d1526' }}>
      <Card style={{ width: 400, background: '#111c32', border: '1px solid #1e2d4a', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', borderRadius: 12 }}>
        <Title level={2} style={{ textAlign: 'center', marginBottom: 24, color: '#e0e6f0' }}>Вход в систему</Title>
        <Form layout="vertical" onFinish={handleSubmit(onSubmit)}>
          <Form.Item
            validateStatus={errors.username ? 'error' : ''}
            help={errors.username?.message}
          >
            <Controller
              name="username"
              control={control}
              render={({ field }) => (
                <Input {...field} prefix={<UserOutlined style={{ color: '#6b7fa8' }} />} placeholder="Логин" size="large" style={inputStyle} />
              )}
            />
          </Form.Item>

          <Form.Item
            validateStatus={errors.password ? 'error' : ''}
            help={errors.password?.message}
          >
            <Controller
              name="password"
              control={control}
              render={({ field }) => (
                <Input.Password {...field} prefix={<LockOutlined style={{ color: '#6b7fa8' }} />} placeholder="Пароль" size="large" style={inputStyle} />
              )}
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
              Войти
            </Button>
          </Form.Item>
        </Form>
      </Card>
      <style>{`
        .ant-input, .ant-input-password, .ant-input-affix-wrapper {
          background: #1a2035 !important;
          border-color: #2d3a55 !important;
          color: #e0e6f0 !important;
        }
        .ant-input-affix-wrapper:hover, .ant-input-affix-wrapper-focused {
          border-color: #3b5bdb !important;
        }
        .ant-input::placeholder, .ant-input-password input::placeholder {
          color: #4a5a7a !important;
        }
        .ant-input-password input {
          background: transparent !important;
          color: #e0e6f0 !important;
        }
        .ant-input-password .ant-input-suffix svg {
          color: #6b7fa8;
        }
      `}</style>
    </div>
  );
};
