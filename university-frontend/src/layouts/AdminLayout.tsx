import React, { useEffect } from 'react';
import { Layout, Menu, Button, theme } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { usePermissions } from '../hooks/usePermissions';
import { GlobalSearch } from '../components/common/GlobalSearch';
import {
  LogoutOutlined, TeamOutlined, ReadOutlined,
  CalendarOutlined, BankOutlined, DollarOutlined, LineChartOutlined,
  SafetyOutlined, SunOutlined, MoonOutlined,
} from '@ant-design/icons';
import { useThemeStore } from '../store/theme.store';

const LAST_ADMIN_PATH_KEY = 'admin_last_path';

const { Header, Sider, Content } = Layout;

export const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuthStore();
  const { token } = theme.useToken();
  const { isSuperAdmin, canAny } = usePermissions();
  const { isDark, toggle: toggleTheme } = useThemeStore();

  useEffect(() => {
    if (location.pathname !== '/admin') {
      localStorage.setItem(LAST_ADMIN_PATH_KEY, location.pathname);
    }
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    {
      key: 'structure',
      icon: <BankOutlined />,
      label: 'Структура',
      children: [
        { key: '/admin/institutes', icon: <BankOutlined />, label: 'Институты' },
        { key: '/admin/departments', icon: <BankOutlined />, label: 'Кафедры' },
        { key: '/admin/programs', icon: <ReadOutlined />, label: 'Направления' },
      ],
    },
    { key: '/admin/groups', icon: <TeamOutlined />, label: 'Группы' },
    { key: '/admin/students', icon: <TeamOutlined />, label: 'Студенты' },
    { key: '/admin/teachers', icon: <TeamOutlined />, label: 'Преподаватели' },
    { key: '/admin/curriculum', icon: <ReadOutlined />, label: 'Учебные планы' },
    // Schedule — show if user has any schedule permission
    ...(canAny(['schedule.input', 'schedule.generate', 'schedule.edit', 'schedule.publish'])
      ? [{ key: '/admin/schedule', icon: <CalendarOutlined />, label: 'Расписание' }]
      : []),
    { key: '/admin/exams', icon: <CalendarOutlined />, label: 'Экзамены' },
    { key: '/admin/payments', icon: <DollarOutlined />, label: 'Оплаты' },
    { key: '/admin/analytics', icon: <LineChartOutlined />, label: 'Аналитика' },
    // Super-admin only
    ...(isSuperAdmin
      ? [{ key: '/admin/admins', icon: <SafetyOutlined />, label: 'Администраторы' }]
      : []),
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={250} theme="dark">
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 18, fontWeight: 'bold' }}>
          Университет
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={['/admin/institutes', '/admin/departments', '/admin/programs'].includes(location.pathname) ? ['structure'] : []}
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
