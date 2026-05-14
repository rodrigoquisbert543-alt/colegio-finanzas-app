# Pasos para el Despliegue Final (Producción)

He preparado el código para funcionar en la nube (Render o Railway). Sigue estos pasos para obtener tu link oficial:

## 1. Crear Base de Datos (PostgreSQL)
- Ve a [Render.com](https://render.com) o [Railway.app](https://railway.app).
- Crea una nueva base de datos **PostgreSQL**.
- Copia la **External Database URL** (empezará con `postgres://...`).

## 2. Desplegar el BACKEND
- Crea un nuevo **Web Service** en Render.
- Conecta tu repositorio de GitHub (o sube los archivos de la carpeta `server`).
- **Variables de Entorno necesarias:**
  - `DATABASE_URL`: (La URL que copiaste en el paso 1).
  - `JWT_SECRET`: `una_clave_secreta_muy_larga_y_segura`.
  - `PORT`: `4000`.
- Comando de inicio: `npx ts-node src/index.ts` (o compilar a JS para mayor velocidad).

## 3. Desplegar el FRONTEND
- Crea un nuevo **Static Site** en Render.
- Conecta la carpeta `client`.
- **Variable de Entorno necesaria:**
  - `VITE_API_URL`: `https://tu-url-de-backend.onrender.com/api` (La URL que te dé Render para el paso 2).
- Comando de Build: `npm run build`.
- Directorio de Publish: `dist`.

---
**¡Listo!** Una vez termines estos 3 pasos, tendrás un link tipo `https://colegio-finanzas.onrender.com` que funcionará en cualquier celular con datos móviles o cualquier Wi-Fi del mundo.
