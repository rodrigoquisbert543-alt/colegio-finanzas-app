import React, { useState, useEffect, useCallback } from 'react';
import { getStats, getUsers } from '../api';
import { BarChart3, Wallet, Landmark, TrendingUp, Sparkles, Receipt } from 'lucide-react';

const Dashboard = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [stats, setStats] = useState({ 
    income_total: 0, 
    expense_total: 0, 
    cash_balance: 0, 
    qr_balance: 0,
    income_cash_total: 0,
    income_qr_total: 0,
    expense_cash_total: 0,
    expense_qr_total: 0
  });
  const [filters, setFilters] = useState({ 
    startDate: '',
    endDate: '',
    userId: user.role !== 'admin' && user.role !== 'contador' ? String(user.id ?? '') : ''
  });
  const [cashiers, setCashiers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [cashArqueo, setCashArqueo] = useState<{ [key: string]: number }>({
    '200': 0, '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '2': 0, '1': 0, '0.5': 0
  });

  const fetchStats = useCallback(async (currentFilters: typeof filters) => {
    setLoading(true);
    try {
      const res = await getStats(currentFilters);
      setStats({
        income_total: Number(res.data.income_total || 0),
        expense_total: Number(res.data.expense_total || 0),
        cash_balance: Number(res.data.income_cash_total || 0) - Number(res.data.expense_cash_total || 0),
        qr_balance: Number(res.data.income_qr_total || 0) - Number(res.data.expense_qr_total || 0),
        income_cash_total: Number(res.data.income_cash_total || 0),
        income_qr_total: Number(res.data.income_qr_total || 0),
        expense_cash_total: Number(res.data.expense_cash_total || 0),
        expense_qr_total: Number(res.data.expense_qr_total || 0)
      });
    } catch (error) {
      console.error('Error al obtener estadÃ­sticas para el dashboard:', error);
      setStats({ 
        income_total: 0, expense_total: 0, cash_balance: 0, qr_balance: 0,
        income_cash_total: 0, income_qr_total: 0, expense_cash_total: 0, expense_qr_total: 0
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Carga inicial y cuando cambian filtros
  useEffect(() => {
    fetchStats(filters);
  }, [filters, fetchStats]);

  useEffect(() => {
    if (user.role === 'admin' || user.role === 'contador') {
      getUsers().then(res => setCashiers(res.data)).catch(() => {});
    }
  }, []);

  const totalArqueo = Object.entries(cashArqueo).reduce((acc, [deno, cant]) => acc + (Number(deno) * cant), 0);
  const difference = totalArqueo - (stats.cash_balance || 0);

  const maxVal = Math.max(stats.income_total, stats.expense_total, 100);
  const incomeHeight = (stats.income_total / maxVal) * 130;
  const expenseHeight = (stats.expense_total / maxVal) * 130;

  const totalIncomes = stats.income_total || 1;
  const cashPercentage = (stats.income_cash_total / totalIncomes) * 100;
  const qrPercentage = (stats.income_qr_total / totalIncomes) * 100;

  return (
    <div className="container">
      <div className="page-header" style={{ marginBottom: '2.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', fontWeight: 'bold', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <Sparkles size={16} />
            Sistema Integrado de Control Interno
          </div>
          <h2 style={{ fontSize: '2.25rem', marginTop: '0.25rem' }}>Panel de Control y Conciliación</h2>
          <p className="page-subtitle">
            {filters.userId
              ? `Caja activa de: ${cashiers.find(c => String(c.id) === String(filters.userId))?.name || user.name}`
              : 'Consolidado General (Todas las Cajas)'}
          </p>
        </div>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--secondary)', fontSize: '0.85rem' }}>
            <div style={{ width: 16, height: 16, border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            Actualizando...
          </div>
        )}
      </div>

      {/* Filter Card */}
      <div className="card" style={{ marginBottom: '2rem', padding: '1.25rem 1.75rem', borderRadius: 'var(--radius-md)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', alignItems: 'end' }}>
          {(user.role === 'admin' || user.role === 'contador') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label>Filtrar por Cajero</label>
              <select 
                value={filters.userId} 
                onChange={(e) => setFilters(prev => ({ ...prev, userId: e.target.value }))}
                style={{ margin: 0, background: '#f8fafc' }}
              >
                <option value="">Todas las Cajas</option>
                {cashiers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.role === 'caja' ? 'Mensualidades' : 'Biblioteca'})</option>
                ))}
              </select>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label>Fecha Inicial</label>
            <input 
              type="date" 
              value={filters.startDate}
              style={{ margin: 0, background: '#f8fafc' }} 
              onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))} 
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label>Fecha Final</label>
            <input 
              type="date" 
              value={filters.endDate}
              style={{ margin: 0, background: '#f8fafc' }} 
              onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))} 
            />
          </div>
          <button 
            onClick={() => setFilters({ 
              startDate: '', 
              endDate: '', 
              userId: user.role !== 'admin' && user.role !== 'contador' ? String(user.id ?? '') : '' 
            })}
            className="btn btn-primary"
            style={{ margin: 0, padding: '0.85rem 1.25rem' }}
          >
            Limpiar Filtros
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="dashboard-grid" style={{ marginBottom: '2rem' }}>
        <div className="card" style={{ borderLeft: '6px solid var(--success)', background: 'linear-gradient(135deg, #ffffff 0%, hsl(var(--success-hue), 72%, 99%) 100%)', opacity: loading ? 0.7 : 1, transition: 'opacity 0.3s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <p style={{ color: 'var(--secondary)', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ingresos Totales</p>
              <h3 style={{ fontSize: '2rem', color: 'var(--success)', margin: '0.5rem 0 0 0', fontWeight: '800' }}>Bs. {Number(stats.income_total || 0).toFixed(2)}</h3>
            </div>
            <div style={{ padding: '0.6rem', borderRadius: '0.5rem', background: 'hsl(var(--success-hue), 72%, 95%)', color: 'var(--success)' }}>
              <TrendingUp size={24} />
            </div>
          </div>
        </div>

        <div className="card" style={{ borderLeft: '6px solid var(--danger)', background: 'linear-gradient(135deg, #ffffff 0%, hsl(var(--danger-hue), 82%, 99%) 100%)', opacity: loading ? 0.7 : 1, transition: 'opacity 0.3s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <p style={{ color: 'var(--secondary)', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Egresos Totales</p>
              <h3 style={{ fontSize: '2rem', color: 'var(--danger)', margin: '0.5rem 0 0 0', fontWeight: '800' }}>Bs. {Number(stats.expense_total || 0).toFixed(2)}</h3>
            </div>
            <div style={{ padding: '0.6rem', borderRadius: '0.5rem', background: 'hsl(var(--danger-hue), 82%, 95%)', color: 'var(--danger)' }}>
              <TrendingUp size={24} style={{ transform: 'rotate(180deg)' }} />
            </div>
          </div>
        </div>

        <div className="card" style={{ borderLeft: '6px solid var(--primary)', background: 'linear-gradient(135deg, #ffffff 0%, hsl(var(--primary-hue), 85%, 99%) 100%)', opacity: loading ? 0.7 : 1, transition: 'opacity 0.3s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <p style={{ color: 'var(--secondary)', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Saldo Efectivo Físico</p>
              <h3 style={{ fontSize: '2rem', color: 'var(--primary)', margin: '0.5rem 0 0 0', fontWeight: '800' }}>Bs. {Number(stats.cash_balance || 0).toFixed(2)}</h3>
            </div>
            <div style={{ padding: '0.6rem', borderRadius: '0.5rem', background: 'hsl(var(--primary-hue), 85%, 95%)', color: 'var(--primary)' }}>
              <Wallet size={24} />
            </div>
          </div>
        </div>

        <div className="card" style={{ borderLeft: '6px solid #8b5cf6', background: 'linear-gradient(135deg, #ffffff 0%, #f5f3ff 100%)', opacity: loading ? 0.7 : 1, transition: 'opacity 0.3s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <p style={{ color: 'var(--secondary)', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Saldo Bancos / QR</p>
              <h3 style={{ fontSize: '2rem', color: '#8b5cf6', margin: '0.5rem 0 0 0', fontWeight: '800' }}>Bs. {Number(stats.qr_balance || 0).toFixed(2)}</h3>
            </div>
            <div style={{ padding: '0.6rem', borderRadius: '0.5rem', background: '#ede9fe', color: '#8b5cf6' }}>
              <Landmark size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <BarChart3 size={20} style={{ color: 'var(--primary)' }} />
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontFamily: 'Plus Jakarta Sans' }}>Resumen Financiero Comparativo</h3>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <svg viewBox="0 0 400 200" width="100%" height="200" style={{ background: 'transparent', overflow: 'visible' }}>
              <line x1="50" y1="30" x2="350" y2="30" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="50" y1="80" x2="350" y2="80" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="50" y1="130" x2="350" y2="130" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="50" y1="180" x2="350" y2="180" stroke="#e2e8f0" strokeWidth="1.5" />
              <text x="40" y="34" fontSize="10" fill="#94a3b8" textAnchor="end">Bs.{maxVal.toFixed(0)}</text>
              <text x="40" y="109" fontSize="10" fill="#94a3b8" textAnchor="end">Bs.{(maxVal/2).toFixed(0)}</text>
              <text x="40" y="184" fontSize="10" fill="#94a3b8" textAnchor="end">0</text>
              <rect x="110" y={180 - incomeHeight} width="45" height={Math.max(incomeHeight, 2)} rx="6" fill="url(#incomeGrad)" />
              <text x="132.5" y={180 - incomeHeight - 8} fontSize="11" fontWeight="bold" fill="var(--success)" textAnchor="middle">Bs. {stats.income_total.toFixed(0)}</text>
              <rect x="220" y={180 - expenseHeight} width="45" height={Math.max(expenseHeight, 2)} rx="6" fill="url(#expenseGrad)" />
              <text x="242.5" y={180 - expenseHeight - 8} fontSize="11" fontWeight="bold" fill="var(--danger)" textAnchor="middle">Bs. {stats.expense_total.toFixed(0)}</text>
              <text x="132.5" y="198" fontSize="11" fontWeight="600" fill="var(--text-muted)" textAnchor="middle">Ingresos</text>
              <text x="242.5" y="198" fontSize="11" fontWeight="600" fill="var(--text-muted)" textAnchor="middle">Egresos</text>
              <defs>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--success)" />
                  <stop offset="100%" stopColor="hsl(var(--success-hue), 72%, 50%)" />
                </linearGradient>
                <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--danger)" />
                  <stop offset="100%" stopColor="hsl(var(--danger-hue), 82%, 65%)" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.25rem', fontFamily: 'Plus Jakarta Sans' }}>Distribución de Métodos de Pago</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--secondary)', marginBottom: '1.5rem' }}>Proporción de pagos en efectivo vs. transferencias digitales (QR)</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.9rem', fontWeight: '600' }}>
                <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}><Wallet size={16} /> Efectivo</span>
                <span>{cashPercentage.toFixed(1)}% ({stats.income_cash_total.toFixed(0)} Bs.)</span>
              </div>
              <div style={{ width: '100%', height: '12px', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ width: `${cashPercentage}%`, height: '100%', background: 'var(--success)', borderRadius: '6px', transition: 'width 0.5s ease-out' }}></div>
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.9rem', fontWeight: '600' }}>
                <span style={{ color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '0.35rem' }}><Landmark size={16} /> QR / Bancos</span>
                <span>{qrPercentage.toFixed(1)}% ({stats.income_qr_total.toFixed(0)} Bs.)</span>
              </div>
              <div style={{ width: '100%', height: '12px', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ width: `${qrPercentage}%`, height: '100%', background: '#8b5cf6', borderRadius: '6px', transition: 'width 0.5s ease-out' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cash Arqueo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
        <div className="card">
          <h3 style={{ marginTop: 0, fontFamily: 'Plus Jakarta Sans' }}>Arqueo de Efectivo Físico</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--secondary)', marginBottom: '1.25rem' }}>Ingrese el recuento físico de billetes y monedas</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            {Object.keys(cashArqueo).sort((a,b) => Number(b)-Number(a)).map(deno => (
              <div key={deno} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ minWidth: '70px', fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-muted)' }}>{deno} Bs:</label>
                <input 
                  type="number" 
                  value={cashArqueo[deno] || ''} 
                  placeholder="0"
                  onChange={(e) => setCashArqueo(prev => ({ ...prev, [deno]: Number(e.target.value) }))}
                  style={{ marginBottom: 0, padding: '0.5rem', fontSize: '0.9rem' }}
                  min="0"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Receipt size={20} style={{ color: 'var(--primary)' }} />
              <h3 style={{ margin: 0, fontFamily: 'Plus Jakarta Sans' }}>Conciliación de Caja</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.85rem 1.1rem', background: '#f8fafc', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <span style={{ fontWeight: '500', color: 'var(--text-muted)' }}>Efectivo Físico:</span>
                <strong style={{ fontSize: '1.15rem' }}>Bs. {totalArqueo.toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.85rem 1.1rem', background: '#f8fafc', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <span style={{ fontWeight: '500', color: 'var(--text-muted)' }}>Saldo Teórico (Caja):</span>
                <strong style={{ fontSize: '1.15rem' }}>Bs. {(stats.cash_balance || 0).toFixed(2)}</strong>
              </div>
            </div>
            <div style={{ 
              padding: '1.25rem', borderRadius: 'var(--radius-md)', width: '100%', textAlign: 'center',
              background: Math.abs(difference) < 0.01 ? 'hsl(142, 72%, 95%)' : difference > 0 ? 'hsl(220, 85%, 95%)' : 'hsl(350, 82%, 95%)',
              color: Math.abs(difference) < 0.01 ? 'var(--success)' : difference > 0 ? 'var(--primary)' : 'var(--danger)',
              border: '1.5px solid',
              borderColor: Math.abs(difference) < 0.01 ? 'rgba(16, 185, 129, 0.2)' : difference > 0 ? 'rgba(37, 99, 235, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              fontWeight: 'bold', transition: 'var(--transition)'
            }}>
                <p style={{ margin: 0, fontSize: '1.2rem', letterSpacing: '-0.02em', textTransform: 'uppercase', fontWeight: '800' }}>
                {Math.abs(difference) < 0.01 ? '✓ CAJA CUADRADA' : difference > 0 ? `SOBRANTE: +Bs. ${difference.toFixed(2)}` : `FALTANTE: -Bs. ${Math.abs(difference).toFixed(2)}`}
              </p>
            </div>
            <p style={{ marginTop: '0.85rem', fontSize: '0.8rem', color: 'var(--secondary)', textAlign: 'center' }}>
              QR/Bancos: Bs. {Number(stats.qr_balance || 0).toFixed(2)} (excluido del arqueo)
            </p>
          </div>
          <button 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '1rem', fontSize: '1.05rem' }} 
            onClick={() => window.print()}
          >
            Imprimir Acta de Arqueo
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default Dashboard;

