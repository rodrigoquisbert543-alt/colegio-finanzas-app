import React, { useState, useEffect } from 'react';
import { getReceipts, getUsers } from '../api'; // Cambiado: ya no se usa getStats
import { Receipt } from '../types'; // Importar el tipo Receipt

const Dashboard = () => {
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  const [stats, setStats] = useState({ income_total: 0, expense_total: 0, cash_balance: 0, qr_balance: 0 });
  const [filters, setFilters] = useState({ 
    startDate: '', // Iniciar sin filtro de fecha
    endDate: '',   // Iniciar sin filtro de fecha
    userId: user.role !== 'admin' && user.role !== 'contador' ? user.id : ''
  });
  const [cashiers, setCashiers] = useState<any[]>([]);
  const [cashArqueo, setCashArqueo] = useState<{ [key: string]: number }>({
    '200': 0, '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '2': 0, '1': 0, '0.5': 0
  });

  useEffect(() => {
    if (user.role === 'admin' || user.role === 'contador') {
      getUsers().then(res => setCashiers(res.data));
    }
  }, []);

  // Lógica de cálculo en el frontend, robusta y a prueba de fallos
  useEffect(() => {
    getReceipts(filters)
      .then(res => {
        // Asegurarnos de que receipts sea siempre un array
        const receipts: Receipt[] = res.data || []; 
        
        const newTotals = receipts.reduce((acc, r) => {
          if (r.status !== 'active') return acc;

          if (r.category.includes('Ingreso')) {
            acc.income_total += r.total_amount;
            acc.cash_balance += r.amount_cash;
            acc.qr_balance += r.amount_qr;
          } else if (r.category.includes('Egreso')) {
            acc.expense_total += r.total_amount;
            acc.cash_balance -= r.amount_cash;
            acc.qr_balance -= r.amount_qr;
          }
          return acc;
        }, { income_total: 0, expense_total: 0, cash_balance: 0, qr_balance: 0 });
        
        setStats(newTotals);
      })
      .catch(error => {
        console.error("Error al obtener recibos para el dashboard:", error);
        // En caso de error, mantener los stats en cero para evitar mostrar datos incorrectos
        setStats({ income_total: 0, expense_total: 0, cash_balance: 0, qr_balance: 0 });
      });
  }, [filters]);

  const totalArqueo = Object.entries(cashArqueo).reduce((acc, [deno, cant]) => acc + (Number(deno) * cant), 0);
  const difference = totalArqueo - (stats.cash_balance || 0);

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h2>Panel de Control y Arqueo</h2>
          <p className="page-subtitle">
            {filters.userId ? `Caja de: ${cashiers.find(c => c.id.toString() === filters.userId.toString())?.name || user.name}` : 'Consolidado General (Todas las Cajas)'}
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.8rem', alignItems: 'end' }}>
          {(user.role === 'admin' || user.role === 'contador') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontWeight: '600', fontSize: '0.9rem' }}>Cajero</label>
              <select 
                value={filters.userId} 
                onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
                style={{ marginBottom: 0, padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}
              >
                <option value="">Todas las Cajas</option>
                {cashiers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.role})</option>
                ))}
              </select>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontWeight: '600', fontSize: '0.9rem' }}>Desde</label>
            <input 
              type="date" 
              value={filters.startDate}
              style={{ marginBottom: 0, padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }} 
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} 
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontWeight: '600', fontSize: '0.9rem' }}>Hasta</label>
            <input 
              type="date" 
              value={filters.endDate}
              style={{ marginBottom: 0, padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }} 
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} 
            />
          </div>
          <button 
            onClick={() => setFilters({ ...filters, startDate: '', endDate: '' })}
            className="btn btn-primary"
            style={{ margin: 0 }}
            title="Limpiar filtros de fecha para ver el historial completo"
          >
            Limpiar Filtros
          </button>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card" style={{ borderLeft: '5px solid var(--success)' }}>
          <p style={{ color: 'var(--secondary)', marginBottom: '0.5rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Ingresos</p>
          <h3 style={{ fontSize: '1.75rem', color: 'var(--success)', margin: '0.5rem 0 0 0' }}>+Bs. {Number(stats.income_total || 0).toFixed(2)}</h3>
        </div>
        <div className="card" style={{ borderLeft: '5px solid var(--danger)' }}>
          <p style={{ color: 'var(--secondary)', marginBottom: '0.5rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Egresos</p>
          <h3 style={{ fontSize: '1.75rem', color: 'var(--danger)', margin: '0.5rem 0 0 0' }}>-Bs. {Number(stats.expense_total || 0).toFixed(2)}</h3>
        </div>
        <div className="card" style={{ borderLeft: '5px solid var(--primary)' }}>
          <p style={{ color: 'var(--secondary)', marginBottom: '0.5rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Saldo en EFECTIVO</p>
          <h3 style={{ fontSize: '1.75rem', margin: '0.5rem 0 0 0' }}>Bs. {Number(stats.cash_balance || 0).toFixed(2)}</h3>
          <small style={{ color: 'var(--secondary)', fontSize: '0.8rem', display: 'block', marginTop: '0.5rem' }}>Sujeto a arqueo físico</small>
        </div>
        <div className="card" style={{ borderLeft: '5px solid #8b5cf6' }}>
          <p style={{ color: 'var(--secondary)', marginBottom: '0.5rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Saldo BANCOS / QR</p>
          <h3 style={{ fontSize: '1.75rem', color: '#8b5cf6', margin: '0.5rem 0 0 0' }}>Bs. {Number(stats.qr_balance || 0).toFixed(2)}</h3>
          <small style={{ color: 'var(--secondary)', fontSize: '0.8rem', display: 'block', marginTop: '0.5rem' }}>No afecta saldo en caja física</small>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Arqueo de Efectivo Físico</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--secondary)', marginBottom: '1.25rem' }}>Desglose para conciliación de caja</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            {Object.keys(cashArqueo).sort((a,b) => Number(b)-Number(a)).map(deno => (
              <div key={deno} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ minWidth: '70px', fontSize: '0.9rem', fontWeight: '500' }}>{deno} Bs:</label>
                <input 
                  type="number" 
                  value={cashArqueo[deno]} 
                  onChange={(e) => setCashArqueo({ ...cashArqueo, [deno]: Number(e.target.value) })}
                  style={{ marginBottom: 0, padding: '0.5rem', fontSize: '0.9rem' }}
                  min="0"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1.25rem' }}>
          <div>
            <h3 style={{ margin: '0 0 1rem 0', textAlign: 'center' }}>Conciliación de Caja</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: '#f8fafc', borderRadius: '0.5rem' }}>
                <span style={{ fontWeight: '500' }}>Efectivo Físico:</span>
                <strong style={{ fontSize: '1.1rem' }}>Bs. {totalArqueo.toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: '#f8fafc', borderRadius: '0.5rem' }}>
                <span style={{ fontWeight: '500' }}>Saldo Teórico:</span>
                <strong style={{ fontSize: '1.1rem' }}>Bs. {(stats.cash_balance || 0).toFixed(2)}</strong>
              </div>
            </div>
            <div style={{ 
              padding: '1rem', 
              borderRadius: '0.75rem', 
              width: '100%',
              textAlign: 'center',
              background: Math.abs(difference) < 0.01 ? '#dcfce7' : difference > 0 ? '#dbeafe' : '#fee2e2',
              color: Math.abs(difference) < 0.01 ? '#166534' : difference > 0 ? '#1e40af' : '#991b1b',
              fontWeight: 'bold'
            }}>
              <p style={{ margin: 0, fontSize: '1.2rem' }}>
                {Math.abs(difference) < 0.01 ? '✓ CAJA CUADRADA' : difference > 0 ? `SOBRANTE: +Bs. ${difference.toFixed(2)}` : `FALTANTE: -Bs. ${Math.abs(difference).toFixed(2)}`}
              </p>
            </div>
            <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--secondary)', textAlign: 'center' }}>
              QR/Bancos: Bs. {Number(stats.qr_balance || 0).toFixed(2)} (excluido del arqueo)
            </p>
          </div>
          <button className="btn btn-primary" style={{ marginTop: 0 }} onClick={() => window.print()}>
            Imprimir Acta de Arqueo
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;