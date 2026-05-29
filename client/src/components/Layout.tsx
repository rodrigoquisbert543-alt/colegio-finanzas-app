import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Receipt, History, LogOut, GraduationCap } from 'lucide-react';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
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
    <div className="layout-shell">
      <aside className="sidebar">
        <div className="brand">SIGE Pro</div>
        <div className="sidebar-nav">
          {filteredItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
            >
              <item.icon size={20} />
              {item.label}
            </Link>
          ))}
        </div>
        <div className="sidebar-footer">
          <button
            onClick={handleLogout}
            className="nav-link"
          >
            <LogOut size={20} />
            Cerrar Sesión
          </button>
        </div>
      </aside>
      <main className="main-panel">
        {children}
      </main>
    </div>
  );
};

export default Layout;

