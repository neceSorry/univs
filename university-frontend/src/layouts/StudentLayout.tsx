import React from 'react';
import { Layout, Menu, Button, theme } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { LogoutOutlined, CalendarOutlined, UserOutlined, ReadOutlined, ScheduleOutlined, CreditCardOutlined, SunOutlined, MoonOutlined, StarOutlined } from '@ant-design/icons';
import { GlobalSearch } from '../components/common/GlobalSearch';
import { useThemeStore } from '../store/theme.store';

const { Header, Sider, Content } = Layout;

export const StudentLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuthStore();
  const { token } = theme.useToken();
  const { isDark, toggle: toggleTheme } = useThemeStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { key: '/student/schedule', icon: <CalendarOutlined />, label: 'Моё расписание' },
    { key: '/student/profile', icon: <UserOutlined />, label: 'Личный кабинет' },
    { key: '/student/journal', icon: <ReadOutlined />, label: 'Журнал' },
    { key: '/student/grades', icon: <StarOutlined />, label: 'Оценки' },
    { key: '/student/exams', icon: <ScheduleOutlined />, label: 'Экзамены' },
    { key: '/student/payments', icon: <CreditCardOutlined />, label: 'Оплаты' },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={250} theme="dark">
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 18, fontWeight: 'bold' }}>
          Кабинет студента
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: '0 24px', background: token.colorBgContainer, display: 'flex', justifyContent: 'space-between', alignItems: 'center', lineHeight: 'normal' }}>
          <GlobalSearch />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button icon={isDark ? <SunOutlined /> : <MoonOutlined />} onClick={toggleTheme} />
            <Button icon={<LogoutOutlined />} onClick={handleLogout}>Выйти</Button>
          </div>
        </Header>
        <Content style={{ margin: '24px', padding: 24, background: token.colorBgContainer, borderRadius: token.borderRadius }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};
