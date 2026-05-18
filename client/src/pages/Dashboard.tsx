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

  // Lógica de cálculo en el frontend
  useEffect(() => {
    getReceipts(filters).then(res => {
      const receipts: Receipt[] = res.data;
      const newTotals = receipts.reduce((acc, r) => {
        if (r.status !== 'active') return acc;

        if (r.category.includes('Ingreso')) {
          acc.income_total += r.total_amount;
          acc.cash_balance += r.amount_cash;
          acc.qr_balance += r.amount_qr;
        } else if (r.category.includes('Egreso')) {
          acc.expense_total += r.total_amount;
          // Asumimos que los egresos también pueden ser en efectivo o QR
          acc.cash_balance -= r.amount_cash;
          acc.qr_balance -= r.amount_qr;
        }
        return acc;
      }, { income_total: 0, expense_total: 0, cash_balance: 0, qr_balance: 0 });
      
      setStats(newTotals);
    });
  }, [filters]);

  const totalArqueo = Object.entries(cashArqueo).reduce((acc, [deno, cant]) => acc + (Number(deno) * cant), 0);
  const difference = totalArqueo - (stats.cash_balance || 0);

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h2>Panel de Control y Arqueo</h2>
          <p style={{ color: 'var(--secondary)', fontSize: '0.9rem' }}>
            {filters.userId ? `Caja de: ${cashiers.find(c => c.id.toString() === filters.userId.toString())?.name || user.name}` : 'Consolidado General (Todas las Cajas)'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {(user.role === 'admin' || user.role === 'contador') && (
            <select 
              value={filters.userId} 
              onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
              style={{ marginBottom: 0, width: 'auto', background: '#e2e8f0' }}
            >
              <option value="">Todas las Cajas</option>
              {cashiers.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.role})</option>
              ))}
            </select>
          )}
          <input 
            type="date" 
            value={filters.startDate}
            style={{ marginBottom: 0, width: 'auto' }} 
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} 
          />
          <input 
            type="date" 
            value={filters.endDate}
            style={{ marginBottom: 0, width: 'auto' }} 
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} 
          />
          <button 
            onClick={() => setFilters({ ...filters, startDate: '', endDate: '' })}
            style={{ padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.25rem', cursor: 'pointer', background: '#f1f5f9' }}
            title="Limpiar filtros de fecha para ver el historial completo"
          >
            Ver Historial Completo
          </button>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card" style={{ borderLeft: '5px solid var(--success)' }}>
          <p style={{ color: 'var(--secondary)', marginBottom: '0.5rem' }}>Total Ingresos</p>
          <h3 style={{ fontSize: '1.5rem', color: 'var(--success)' }}>+Bs. {Number(stats.income_total || 0).toFixed(2)}</h3>
        </div>
        <div className="card" style={{ borderLeft: '5px solid var(--danger)' }}>
          <p style={{ color: 'var(--secondary)', marginBottom: '0.5rem' }}>Total Egresos</p>
          <h3 style={{ fontSize: '1.5rem', color: 'var(--danger)' }}>-Bs. {Number(stats.expense_total || 0).toFixed(2)}</h3>
        </div>
        <div className="card" style={{ borderLeft: '5px solid var(--primary)' }}>
          <p style={{ color: 'var(--secondary)', marginBottom: '0.5rem' }}>Saldo en EFECTIVO</p>
          <h3 style={{ fontSize: '1.5rem' }}>Bs. {Number(stats.cash_balance || 0).toFixed(2)}</h3>
          <small style={{ color: 'var(--secondary)' }}>Sujeto a arqueo físico</small>
        </div>
        <div className="card" style={{ borderLeft: '5px solid #8b5cf6' }}>
          <p style={{ color: 'var(--secondary)', marginBottom: '0.5rem' }}>Saldo BANCOS / QR</p>
          <h3 style={{ fontSize: '1.5rem' }}>Bs. {Number(stats.qr_balance || 0).toFixed(2)}</h3>
          <small style={{ color: 'var(--secondary)' }}>No afecta saldo en caja física</small>
        </div>
      </div>

      <div className="grid-2-cols" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
        <div className="card">
          <h3>Arqueo de Efectivo Físico</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--secondary)', marginBottom: '1rem' }}>Desglose para conciliación de caja</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            {Object.keys(cashArqueo).sort((a,b) => Number(b)-Number(a)).map(deno => (
              <div key={deno} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ minWidth: '60px' }}>{deno} Bs:</span>
                <input 
                  type="number" 
                  value={cashArqueo[deno]} 
                  onChange={(e) => setCashArqueo({ ...cashArqueo, [deno]: Number(e.target.value) })}
                  style={{ marginBottom: 0, padding: '4px' }}
                  min="0"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <h3>Conciliación de Caja</h3>
          <div style={{ margin: '1.5rem 0' }}>
            <p>Efectivo Físico (Contado): <strong style={{ fontSize: '1.25rem' }}>Bs. {totalArqueo.toFixed(2)}</strong></p>
            <p>Saldo Teórico (Sistema): <strong>Bs. {(stats.cash_balance || 0).toFixed(2)}</strong></p>
          </div>
          <div style={{ 
            padding: '1rem', 
            borderRadius: '0.5rem', 
            width: '100%',
            background: Math.abs(difference) < 0.01 ? '#dcfce7' : difference > 0 ? '#dbeafe' : '#fee2e2',
            color: Math.abs(difference) < 0.01 ? '#166534' : difference > 0 ? '#1e40af' : '#991b1b'
          }}>
            <p style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
              {Math.abs(difference) < 0.01 ? 'CAJA CUADRADA' : difference > 0 ? `SOBRANTE: Bs. ${difference.toFixed(2)}` : `FALTANTE: Bs. ${Math.abs(difference).toFixed(2)}`}
            </p>
          </div>
          <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--secondary)' }}>
            Nota: Los ingresos por QR (Bs. {Number(stats.qr_balance || 0).toFixed(2)}) ya han sido excluidos de este arqueo.
          </p>
          <button className="btn btn-primary" style={{ marginTop: '1.5rem', width: '100%' }} onClick={() => window.print()}>
            Imprimir Acta de Arqueo
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;