import React, { useState, useEffect } from 'react';
import { getStudents, createStudent } from '../api';
import { Student } from '../types';

const Students = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const [fee, setFee] = useState(0);

  useEffect(() => {
    const loadStudents = async () => {
      const res = await getStudents();
      setStudents(res.data);
    };

    void loadStudents();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createStudent({ name, grade, monthly_fee: fee });
    setName(''); setGrade(''); setFee(0);
    const res = await getStudents();
    setStudents(res.data);
  };

  return (
    <div className="container">
      <div className="card">
        <h2>Registrar Nuevo Estudiante</h2>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
          <div>
            <label>Nombre Completo</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label>Grado</label>
            <input type="text" value={grade} onChange={(e) => setGrade(e.target.value)} required />
          </div>
          <div>
            <label>Cuota Mensual (Bs.)</label>
            <input type="number" value={fee} onChange={(e) => setFee(Number(e.target.value))} required />
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginBottom: '1rem' }}>Agregar</button>
        </form>
      </div>

      <div className="card">
        <h2>Listado de Estudiantes</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
              <th>Nombre</th>
              <th>Grado</th>
              <th>Mensualidad Base</th>
            </tr>
          </thead>
          <tbody>
            {students.map(s => (
              <tr key={s.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '0.75rem' }}>{s.name}</td>
                <td>{s.grade}</td>
                <td>Bs. {Number(s.monthly_fee).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Students;