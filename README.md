# Colegio Finanzas App

Sistema de gestión financiera para colegio con:

- Frontend en React + TypeScript + Vite (`client/`)
- Backend en Node + Express + TypeScript (`server/`)
- Base de datos PostgreSQL
- Autenticación JWT

## Estructura

- `client/`: app web para usuarios, emisión de comprobantes, historial y gestión de estudiantes.
- `server/`: API REST con login, control de recibos, gestión de estudiantes y estadísticas.
- `INSTRUCCIONES_NUBE.md`: pasos de despliegue en la nube.

## Mejoras aplicadas

- `server/package.json`: scripts de `dev`, `build` y `start` para producción.
- `client/src/App.tsx`: ruta comodín para redirigir a `login` cuando no existe la ruta.
- `server/src/index.ts`: ruta de salud `GET /api/health` para verificar el servicio.
- `client/src/pages/History.tsx`: limpieza de import innecesario.
- `render.yaml`: configuración de Render para desplegar API y frontend.
- `server/.env.example` y `client/.env.example`: ejemplos de variables de entorno.

## Variables de entorno

### Backend (`server`)

- `DATABASE_URL`
- `JWT_SECRET`
- `PORT` (opcional, por defecto `4000`)

### Frontend (`client`)

- `VITE_API_URL`

## Ejecución local

### Backend

```bash
cd server
npm install
npm run dev
```

### Frontend

```bash
cd client
npm install
npm run dev
```

## Deploy en Render

1. Conecta el repositorio a Render.
2. Crea un servicio `Web Service` para `server`.
   - Build Command: `cd server && npm install && npm run build`
   - Start Command: `cd server && npm run start`
   - Environment Variables: `DATABASE_URL`, `JWT_SECRET`, `PORT`
3. Crea un `Static Site` para `client`.
   - Build Command: `cd client && npm install && npm run build`
   - Publish Directory: `client/dist`
   - Environment Variable: `VITE_API_URL`
4. Opcional: Render detectará `render.yaml` si está habilitado en el repositorio.
