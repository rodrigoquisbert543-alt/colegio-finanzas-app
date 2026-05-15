import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Receipt, History, LogOut, GraduationCap } from 'lucide-react';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    navigate('/login');
  };

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'contador', 'biblioteca', 'caja'] },
    { path: '/emit', label: 'Emitir Comprobante', icon: Receipt, roles: ['biblioteca', 'caja'] },
    { path: '/history', label: 'Detalle de Caja', icon: History, roles: ['admin', 'contador', 'biblioteca', 'caja'] },
    { path: '/students', label: 'Estudiantes', icon: GraduationCap, roles: ['admin'] },
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(user.role));

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: '250px', background: '#1e293b', color: 'white', padding: '1rem' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '2rem' }}>SIGE Pro</h2>
        <nav>
          {filteredItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                color: location.pathname === item.path ? '#3b82f6' : 'white',
                textDecoration: 'none',
                borderRadius: '0.25rem',
                marginBottom: '0.5rem',
                background: location.pathname === item.path ? '#334155' : 'transparent'
              }}
            >
              <item.icon size={20} />
              {item.label}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem',
              color: 'white',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              width: '100%',
              textAlign: 'left',
              marginTop: 'auto'
            }}
          >
            <LogOut size={20} />
            Cerrar Sesión
          </button>
        </nav>
      </aside>
      <main style={{ flex: 1, padding: '2rem', background: '#f8fafc' }}>
        {children}
      </main>
    </div>
  );
};

export default Layout;
