import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await login({ username, password });
      sessionStorage.setItem('token', response.data.token);
      sessionStorage.setItem('user', JSON.stringify(response.data.user));
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al iniciar sesión');
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e293b' }}>
      <form onSubmit={handleSubmit} className="card" style={{ width: '300px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>SIGE Pro</h2>
        {error && <p style={{ color: 'red', fontSize: '0.875rem' }}>{error}</p>}
        <label>Usuario</label>
        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
        <label>Contraseña</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Entrar</button>
      </form>
    </div>
  );
};

export default Login;
