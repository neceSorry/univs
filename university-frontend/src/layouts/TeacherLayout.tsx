import React from 'react';
import { Layout, Menu, Button, theme } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { LogoutOutlined, ReadOutlined, TeamOutlined, CalendarOutlined, ScheduleOutlined, SunOutlined, MoonOutlined } from '@ant-design/icons';
import { GlobalSearch } from '../components/common/GlobalSearch';
import { useThemeStore } from '../store/theme.store';

const { Header, Sider, Content } = Layout;

export const TeacherLayout: React.FC = () => {
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
    { key: '/teacher/schedule',     icon: <ScheduleOutlined />, label: 'Моё расписание' },
    { key: '/teacher/disciplines',  icon: <ReadOutlined />,     label: 'Мои дисциплины' },
    { key: '/teacher/groups',       icon: <TeamOutlined />,     label: 'Журнал оценок' },
    { key: '/teacher/exams',        icon: <CalendarOutlined />, label: 'Мои экзамены' },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={250} theme="dark">
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 18, fontWeight: 'bold' }}>
          Кабинет преподавателя
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
