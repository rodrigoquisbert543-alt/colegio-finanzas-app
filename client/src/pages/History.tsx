import React, { useState, useEffect } from 'react';
import { getReceipts, cancelReceipt } from '../api';
import { Receipt } from '../types';
import { Search, XCircle, Printer } from 'lucide-react';

const History = () => {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    folio: '',
    category: '',
    studentName: ''
  });
  const [selectedForPrint, setSelectedMonthForPrint] = useState<any>(null); // Misleading name, but sticking to logic
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');

  const fetchReceipts = async () => {
    const res = await getReceipts(filters);
    setReceipts(res.data);
  };

  useEffect(() => {
    fetchReceipts();
  }, [filters]);

  const handleCancel = async (id: number) => {
    const reason = prompt('Motivo de la anulación:');
    if (!reason) return;
    try {
      await cancelReceipt(id, reason);
      fetchReceipts();
    } catch (err) {
      alert('Error al anular');
    }
  };

  const handlePrint = (r: Receipt) => {
    // Setup data for the printable hidden div
    const printData = {
      folio: r.folio,
      date: new Date(r.date).toLocaleString(),
      studentName: r.studentName || 'Cliente General',
      concept: r.concept,
      category: r.category,
      amountCash: r.amount_cash,
      amountQr: r.amount_qr,
      totalAmount: r.total_amount,
      issuer: r.userName || 'Sistema'
    };
    
    // We use a trick: store it in a state that triggers a render of the printable div, then print.
    // However, to make it instant like in EmitReceipt, we'll use a temporary state.
    setSelectedMonthForPrint(printData);
    setTimeout(() => {
      window.print();
      setSelectedMonthForPrint(null);
    }, 100);
  };

  const handleExport = () => {
    const headers = ['Folio', 'Fecha', 'Cliente', 'Concepto', 'Categoria', 'Efectivo', 'QR', 'Total', 'Estado'];
    const rows = receipts.map(r => [
      r.folio,
      new Date(r.date).toLocaleDateString(),
      r.studentName || 'General',
      r.concept,
      r.category,
      r.amount_cash,
      r.amount_qr,
      r.total_amount,
      r.status
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `reporte_contable_${filters.startDate || 'full'}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  return (
    <div className="container">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>Historial y Auditoría</h2>
          <button onClick={handleExport} className="btn btn-primary" style={{ background: '#059669' }}>
            Exportar Excel (CSV)
          </button>
        </div>
        
        <div className="dashboard-grid" style={{ marginBottom: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          <input type="text" placeholder="Buscar por Cliente..." onChange={(e) => setFilters({...filters, studentName: e.target.value})} />
          <input type="text" placeholder="Nro de Comprobante" onChange={(e) => setFilters({...filters, folio: e.target.value})} />
          <select onChange={(e) => setFilters({...filters, category: e.target.value})}>
            <option value="">Todos los tipos</option>
            <optgroup label="INGRESOS">
              <option value="Ingreso: Transporte">Transporte</option>
              <option value="Ingreso: Otros ingresos">Otros ingresos</option>
            </optgroup>
            <optgroup label="EGRESOS">
              <option value="Egreso: Material de Escritorio">Material de Escritorio</option>
              <option value="Egreso: Otros Egresos">Otros Egresos</option>
            </optgroup>
          </select>
          <input type="date" title="Desde" onChange={(e) => setFilters({...filters, startDate: e.target.value})} />
          <input type="date" title="Hasta" onChange={(e) => setFilters({...filters, endDate: e.target.value})} />
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
              <th>Folio</th>
              <th>Fecha</th>
              <th>Cliente / Alumno</th>
              <th>Concepto</th>
              <th>Efectivo</th>
              <th>QR</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {receipts.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid #e2e8f0', background: r.status === 'cancelled' ? '#fee2e2' : 'transparent' }}>
                <td style={{ padding: '0.75rem' }}>{r.folio}</td>
                <td>{new Date(r.date).toLocaleDateString()}</td>
                <td>{r.studentName || 'General'}</td>
                <td>{r.concept}</td>
                <td>Bs. {r.amount_cash.toFixed(2)}</td>
                <td>Bs. {r.amount_qr.toFixed(2)}</td>
                <td style={{ fontWeight: 'bold' }}>Bs. {r.total_amount.toFixed(2)}</td>
                <td>
                  <span style={{ 
                    padding: '2px 8px', 
                    borderRadius: '10px', 
                    fontSize: '0.75rem',
                    background: r.status === 'active' ? '#dcfce7' : '#fef2f2',
                    color: r.status === 'active' ? '#166534' : '#991b1b'
                  }}>
                    {r.status === 'active' ? 'Activo' : 'Anulado'}
                  </span>
                </td>
                <td style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={() => handlePrint(r)} className="btn btn-primary" style={{ padding: '4px', background: '#64748b' }} title="Re-imprimir">
                    <Printer size={16} />
                  </button>
                  {r.status === 'active' && (user.role === 'biblioteca' || user.role === 'caja' || user.role === 'admin') && (
                    <button onClick={() => handleCancel(r.id)} className="btn btn-danger" style={{ padding: '4px' }} title="Anular">
                      <XCircle size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Hidden printable receipt for history */}
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
        </div>
      )}
    </div>
  );
};

export default History;