import React, { useState, useEffect, useRef } from 'react';
import { getReceipts, cancelReceipt, getUsers, getStats } from '../api';
import { Receipt } from '../types';
import { XCircle, Printer } from 'lucide-react';

interface HistoryFilters {
  startDate: string;
  endDate: string;
  folio: string;
  category: string;
  studentName: string;
  userId?: string; 
}

const History = () => {
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [filters, setFilters] = useState<HistoryFilters>({
    startDate: '',
    endDate: '',
    folio: '',
    category: '',
    studentName: '',
    userId: user.role !== 'admin' && user.role !== 'contador' ? String(user.id ?? '') : '',
  });
  const [categoryValues, setCategoryValues] = useState<string[]>([]);
  const [cajeros, setCajeros] = useState<any[]>([]);
  const [selectedForPrint, setSelectedForPrint] = useState<any>(null);
  const [filteredTotals, setFilteredTotals] = useState({ income: 0, expense: 0, income_cash: 0, income_qr: 0 });
  const [loading, setLoading] = useState(false);

  // Ref para evitar llamadas duplicadas cuando categoryValues actualiza filters
  const isFetchingRef = useRef(false);

  // Sincronizar categoryValues → filters.category SIN disparar el fetch directamente
  // El fetch lo maneja el useEffect de filters
  const pendingCategoryRef = useRef<string | null>(null);

  useEffect(() => {
    const newCategory = categoryValues.join(',');
    // Solo actualizar si realmente cambió
    if (newCategory !== filters.category) {
      pendingCategoryRef.current = newCategory;
      setFilters(prev => ({ ...prev, category: newCategory }));
    }
  }, [categoryValues]);

  // Fetch principal — se dispara solo cuando filters cambia
  useEffect(() => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    const load = async () => {
      setLoading(true);
      try {
        const [receiptsRes, totalsRes] = await Promise.all([
          getReceipts(filters),
          getStats(filters)
        ]);
        setReceipts(receiptsRes.data);
        setFilteredTotals({
          income: Number(totalsRes.data.income_total || 0),
          expense: Number(totalsRes.data.expense_total || 0),
          income_cash: Number(totalsRes.data.income_cash_total || 0),
          income_qr: Number(totalsRes.data.income_qr_total || 0),
        });
      } catch (error) {
        console.error("Error al cargar datos:", error);
        setReceipts([]);
        setFilteredTotals({ income: 0, expense: 0, income_cash: 0, income_qr: 0 });
      } finally {
        setLoading(false);
        isFetchingRef.current = false;
      }
    };

    load();
  }, [filters]);

  useEffect(() => {
    if (user.role === 'admin' || user.role === 'contador') {
      getUsers()
        .then(res => setCajeros(res.data))
        .catch(() => {});
    }
  }, []);

  const handleCancel = async (id: number) => {
    const reason = prompt('Motivo de la anulación:');
    if (!reason) return;
    try {
      await cancelReceipt(id, reason);
      // Refrescar recargando con los mismos filtros
      setFilters(prev => ({ ...prev }));
    } catch (err) {
      alert('Error al anular');
    }
  };

  const handleClearFilters = () => {
    setCategoryValues([]);
    setFilters({
      startDate: '',
      endDate: '',
      folio: '',
      category: '',
      studentName: '',
      userId: user.role !== 'admin' && user.role !== 'contador' ? String(user.id ?? '') : '',
    });
  };

  const handlePrint = (r: Receipt) => {
    const printData = {
      folio: r.folio, date: new Date(r.date).toLocaleString(), studentName: r.studentName || 'Cliente General',
      concept: r.concept, category: r.category, amountCash: r.amount_cash, amountQr: r.amount_qr,
      totalAmount: r.total_amount, issuer: r.userName || 'Sistema'
    };
    setSelectedForPrint(printData);
    setTimeout(() => {
      window.print();
      setSelectedForPrint(null);
    }, 100);
  };

  const handleExport = () => {
    const headers = ['Folio', 'Fecha', 'Cliente', 'Concepto', 'Categoria', 'Efectivo', 'QR', 'Total', 'Estado'];
    const rows = receipts.map(r => [
      r.folio, new Date(r.date).toLocaleDateString(), r.studentName || 'General', r.concept, r.category,
      r.amount_cash, r.amount_qr, r.total_amount, r.status
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `reporte_contable_${filters.startDate || 'full'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="container">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h2 style={{ margin: 0 }}>Historial y Auditoría</h2>
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--secondary)', fontSize: '0.8rem' }}>
                <div style={{ width: 14, height: 14, border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Cargando...
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={handleClearFilters} className="btn" style={{ background: '#94a3b8', color: '#fff' }}>
              Limpiar filtros
            </button>
            <button onClick={handleExport} className="btn btn-primary" style={{ background: '#059669' }}>
              Exportar Excel (CSV)
            </button>
          </div>
        </div>
        
        <div className="dashboard-grid" style={{ marginBottom: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          <input
            type="text"
            value={filters.studentName}
            placeholder="Buscar por Cliente..."
            onChange={(e) => setFilters(prev => ({ ...prev, studentName: e.target.value }))}
          />
          <input
            type="text"
            value={filters.folio}
            placeholder="Nro de Comprobante"
            onChange={(e) => setFilters(prev => ({ ...prev, folio: e.target.value }))}
          />
          <select 
            multiple
            value={categoryValues}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions, option => option.value);
              setCategoryValues(selected);
            }}
            title="Selecciona varias categorías con Ctrl/Cmd"
            style={{ minHeight: '140px' }}
          >
            <optgroup label="INGRESOS">
              <option value="Ingreso: Inscripción a campamentos">Inscripción a campamentos</option>
              <option value="Ingreso: Sesiones de Psicología">Sesiones de Psicología</option>
              <option value="Ingreso: Alquileres">Alquileres</option>
              <option value="Ingreso: Transporte">Transporte</option>
              <option value="Ingreso: Otros ingresos">Otros ingresos</option>
            </optgroup>
            <optgroup label="EGRESOS">
              <option value="Egreso: Campamentos">Campamentos</option>
              <option value="Egreso: Material de Escritorio">Material de Escritorio</option>
              <option value="Egreso: Otros Egresos">Otros Egresos</option>
            </optgroup>
          </select>
          <input
            type="date"
            title="Desde"
            value={filters.startDate}
            onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
          />
          <input
            type="date"
            title="Hasta"
            value={filters.endDate}
            onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
          />
          {(user.role === 'admin' || user.role === 'contador') && (
            <select
              value={filters.userId || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, userId: e.target.value }))}
            >
              <option value="">Todos los Cajeros</option>
              {cajeros.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Totales con filtro */}
        <div className="summary-box">
          <div className="summary-item income">
            <div>
              <strong>Total Ingresos (filtro)</strong>
              <p className="summary-note">Solo comprobantes activos</p>
            </div>
            <span>Bs. {filteredTotals.income.toFixed(2)}</span>
          </div>
          <div className="summary-item" style={{ background: '#ecfdf5' }}>
            <div>
              <strong>Ingresos en Efectivo</strong>
              <p className="summary-note">Movimiento de caja</p>
            </div>
            <span>Bs. {filteredTotals.income_cash.toFixed(2)}</span>
          </div>
          <div className="summary-item" style={{ background: '#f5f3ff' }}>
            <div>
              <strong>Ingresos QR/Banco</strong>
              <p className="summary-note">Transferencias y pagos digitales</p>
            </div>
            <span>Bs. {filteredTotals.income_qr.toFixed(2)}</span>
          </div>
          <div className="summary-item expense">
            <div>
              <strong>Total Egresos (filtro)</strong>
              <p className="summary-note">Solo comprobantes activos</p>
            </div>
            <span>Bs. {filteredTotals.expense.toFixed(2)}</span>
          </div>
        </div>

        <div className="table-responsive">
          <table>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                <th>Folio</th><th>Fecha</th><th>Cliente / Alumno</th><th>Concepto</th>
                <th>Efectivo</th><th>QR</th><th>Total</th><th>Estado</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {receipts.length === 0 && !loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--secondary)' }}>
                    No se encontraron comprobantes con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                receipts.map(r => (
                  <tr 
                    key={r.id} 
                    style={{ 
                      borderBottom: '1px solid #e2e8f0', 
                      backgroundColor: r.status === 'cancelled' ? '#fee2e2' : r.category.includes('Ingreso') ? '#f0fdf4' : '#f8fafc'
                    }}
                  >
                    <td style={{ padding: '0.75rem' }}>{r.folio}</td>
                    <td>{new Date(r.date).toLocaleDateString()}</td>
                    <td>{r.studentName || 'General'}</td>
                    <td>{r.concept}</td>
                    <td>Bs. {Number(r.amount_cash).toFixed(2)}</td>
                    <td>Bs. {Number(r.amount_qr).toFixed(2)}</td>
                    <td style={{ fontWeight: 'bold' }}>Bs. {Number(r.total_amount).toFixed(2)}</td>
                    <td>
                      <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', background: r.status === 'active' ? '#dcfce7' : '#fef2f2', color: r.status === 'active' ? '#166534' : '#991b1b' }}>
                        {r.status === 'active' ? 'Activo' : 'Anulado'}
                      </span>
                    </td>
                    <td style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => handlePrint(r)} className="btn btn-primary" style={{ padding: '4px', background: '#64748b' }} title="Re-imprimir"><Printer size={16} /></button>
                      {r.status === 'active' && (user.role === 'biblioteca' || user.role === 'caja' || user.role === 'admin') && (
                        <button onClick={() => handleCancel(r.id)} className="btn btn-danger" style={{ padding: '4px' }} title="Anular"><XCircle size={16} /></button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedForPrint && (
        <div id="printable-receipt">
          <div className="receipt-header">
            <h3>SIGE PRO - COLEGIO</h3>
            <p style={{ fontSize: '14px', fontWeight: 'bold' }}>{selectedForPrint.category.includes('Ingreso') ? 'COMPROBANTE DE INGRESO' : 'COMPROBANTE DE EGRESO'}</p>
            <p><strong>Folio: {selectedForPrint.folio}</strong></p>
            <p>(COPIA - REIMPRESIÓN)</p>
          </div>
          <div className="receipt-row"><span>Fecha:</span> <span>{selectedForPrint.date}</span></div>
          <div className="receipt-row"><span>Entregado a/por:</span> <span>{selectedForPrint.studentName}</span></div>
          <div className="receipt-row"><span>Concepto:</span> <span>{selectedForPrint.concept}</span></div>
          <div className="receipt-row"><span>Categoría:</span> <span>{selectedForPrint.category}</span></div>
          <br />
          <div className="receipt-row"><span>Monto Efectivo:</span> <span>Bs. {Number(selectedForPrint.amountCash).toFixed(2)}</span></div>
          <div className="receipt-row"><span>Monto QR/Banco:</span> <span>Bs. {Number(selectedForPrint.amountQr).toFixed(2)}</span></div>
          <div className="receipt-total">
            <div className="receipt-row"><span>TOTAL GENERAL:</span> <span>Bs. {Number(selectedForPrint.totalAmount).toFixed(2)}</span></div>
          </div>
          <br />
          <p style={{ textAlign: 'center' }}>Emitido por: {selectedForPrint.issuer}</p>
          <p style={{ textAlign: 'center', fontSize: '10px' }}>Documento de Control Interno</p>
          <div className="receipt-signature">Recibí Conforme</div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default History;
