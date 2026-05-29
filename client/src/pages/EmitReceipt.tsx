import React, { useState, useEffect } from 'react';
import { getStudents, createReceipt, getLastReceiptByName } from '../api';
import { Receipt, Student } from '../types';

type PrintableReceipt = Receipt & {
  studentName: string;
  issuer: string;
  amountCash: number;
  amountQr: number;
  totalAmount: number;
  date: string;
};

const EmitReceipt = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [studentName, setStudentName] = useState<string>('');
  const [concept, setConcept] = useState('');
  const [category, setCategory] = useState('Ingreso: Transporte');
  const [amountCash, setAmountCash] = useState(0);
  const [amountQr, setAmountQr] = useState(0);
  const [lastReceipt, setLastReceipt] = useState<PrintableReceipt | null>(null);
  
  // Anti-translation list: we use Mayo (M) to confuse less the auto-translators, 
  // but better yet, we will use the translate="no" attribute in the HTML.
  const LIST_OF_MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const [selectedMonth, setSelectedMonth] = useState(LIST_OF_MONTHS[new Date().getMonth()]);
  const user = JSON.parse(sessionStorage.getItem('user') || '{}') as { name?: string };

  const fetchSuggestions = () => {
    getStudents().then(res => setStudents(res.data));
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  // Auto-update concept for Transporte
  const handleNameChange = async (name: string) => {
    setStudentName(name);
    
    if (students.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      try {
        const res = await getLastReceiptByName(name);
        if (res.data) {
          setCategory(res.data.category);
          setAmountCash(res.data.amount_cash || 0);
          setAmountQr(res.data.amount_qr || 0);
          if (res.data.category !== 'Ingreso: Transporte') {
            setConcept(res.data.concept);
          }
        }
      } catch (err) {
        console.error('Error fetching last operation data', err);
      }
    }
  };

  const totalAmount = Number(amountCash) + Number(amountQr);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalAmount <= 0) return alert('El monto total debe ser mayor a 0');

    try {
      const response = await createReceipt({
        student_name: studentName,
        concept,
        category,
        amount_cash: amountCash,
        amount_qr: amountQr,
        total_amount: totalAmount
      });
      
      const receiptData: PrintableReceipt = {
        ...response.data,
        concept,
        category,
        amountCash,
        amountQr,
        totalAmount,
        studentName: studentName || 'Cliente General',
        date: new Date().toLocaleString(),
        issuer: user.name || 'Sistema'
      };

      setLastReceipt(receiptData);
      
      setTimeout(() => {
        window.print();
        setConcept('');
        setAmountCash(0);
        setAmountQr(0);
        setStudentName('');
        fetchSuggestions(); 
      }, 500);

    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message || 'Error al emitir el comprobante');
    }
  };

  return (
    <div className="container">
      <div className="card">
        <h2>Emitir Nuevo Comprobante</h2>
        <form onSubmit={handleSubmit}>
          <label>Cliente / Alumno / Destinatario</label>
          <input 
            type="text" 
            list="student-list"
            value={studentName} 
            onChange={(e) => handleNameChange(e.target.value)} 
            placeholder="Escriba el nombre (se autocompleta si ya existe)"
          />
          <datalist id="student-list">
            {students.map(s => (
              <option key={s.id} value={s.name} />
            ))}
          </datalist>

          <label>Tipo de Operación</label>
          <select value={category} onChange={(e) => {
            const value = e.target.value;
            setCategory(value);
            if (value === 'Ingreso: Transporte') {
              setConcept(`Transporte - ${selectedMonth} ${new Date().getFullYear()}`);
            }
          }}>
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

          {category === 'Ingreso: Transporte' && (
            <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f1f5f9', borderRadius: '0.25rem' }}>
              <label>Mes de Servicio (Transporte)</label>
              {/* Added translate="no" to avoid browser "Mayonesa" bug */}
              <select 
                value={selectedMonth} 
                onChange={(e) => {
                  const month = e.target.value;
                  setSelectedMonth(month);
                  if (category === 'Ingreso: Transporte') {
                    setConcept(`Transporte - ${month} ${new Date().getFullYear()}`);
                  }
                }}
                translate="no"
                className="notranslate"
              >
                {LIST_OF_MONTHS.map(m => (
                  <option key={m} value={m} translate="no" className="notranslate">{m}</option>
                ))}
              </select>
            </div>
          )}

          <label>Concepto / Detalle</label>
          <input 
            type="text" 
            value={concept} 
            onChange={(e) => setConcept(e.target.value)} 
            required 
            placeholder="Detalle de la operación..." 
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: '#ecfdf5', borderRadius: '0.25rem' }}>
              <label style={{ color: '#065f46', fontWeight: 'bold' }}>PAGO EN EFECTIVO</label>
              <input 
                type="number" 
                value={amountCash} 
                onChange={(e) => setAmountCash(Number(e.target.value))} 
                min="0" 
                style={{ borderColor: '#059669' }}
              />
              <small>Este monto entra a la caja física</small>
            </div>
            <div style={{ padding: '1rem', background: '#f5f3ff', borderRadius: '0.25rem' }}>
              <label style={{ color: '#5b21b6', fontWeight: 'bold' }}>PAGO QR / BANCO</label>
              <input 
                type="number" 
                value={amountQr} 
                onChange={(e) => setAmountQr(Number(e.target.value))} 
                min="0" 
                style={{ borderColor: '#7c3aed' }}
              />
              <small>Este monto NO entra a la caja física</small>
            </div>
          </div>

          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '1.5rem 0', textAlign: 'right', color: 'var(--primary)' }}>
            TOTAL: Bs. {totalAmount.toFixed(2)}
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', fontSize: '1.1rem', padding: '0.75rem' }}>
            Generar e Imprimir Comprobante
          </button>
        </form>
      </div>

      {lastReceipt && (
        <div id="printable-receipt" translate="no" className="notranslate">
          <div className="receipt-header">
            <h3>SIGE PRO - COLEGIO</h3>
            <p style={{ fontSize: '14px', fontWeight: 'bold' }}>{lastReceipt.category.includes('Ingreso') ? 'COMPROBANTE DE INGRESO' : 'COMPROBANTE DE EGRESO'}</p>
            <p><strong>Folio: {lastReceipt.folio}</strong></p>
          </div>
          <div className="receipt-row"><span>Fecha:</span> <span>{lastReceipt.date}</span></div>
          <div className="receipt-row"><span>Entregado a/por:</span> <span>{lastReceipt.studentName}</span></div>
          <div className="receipt-row"><span>Concepto:</span> <span>{lastReceipt.concept}</span></div>
          <div className="receipt-row"><span>Categoría:</span> <span>{lastReceipt.category}</span></div>
          <br />
          <div className="receipt-row"><span>Monto Efectivo:</span> <span>Bs. {Number(lastReceipt.amountCash).toFixed(2)}</span></div>
          <div className="receipt-row"><span>Monto QR/Banco:</span> <span>Bs. {Number(lastReceipt.amountQr).toFixed(2)}</span></div>
          <div className="receipt-total">
            <div className="receipt-row"><span>TOTAL GENERAL:</span> <span>Bs. {Number(lastReceipt.totalAmount).toFixed(2)}</span></div>
          </div>
          <br />
          <p style={{ textAlign: 'center' }}>Emitido por: {lastReceipt.issuer}</p>
          <p style={{ textAlign: 'center', fontSize: '10px' }}>Documento de Control Interno</p>
          <div className="receipt-signature">
            Recibí Conforme
          </div>
        </div>
      )}
    </div>
  );
};

export default EmitReceipt;
