# ExamGen AI - Deployment Instructions

## 🚀 Desplegar en Netlify

### Paso 1: Configurar Variables de Entorno en Netlify

1. Ve a tu sitio en Netlify
2. Click en **Site settings** → **Environment variables**
3. Añade la siguiente variable:
   - **Key:** `VITE_GEMINI_API_KEY`
   - **Value:** Tu API key de Google Gemini

### Paso 2: Configurar el Build


Netlify debería detectar automáticamente la configuración del archivo `netlify.toml`, pero si no:

1. Ve a **Site settings** → **Build & deploy** → **Build settings**
2. Configura:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`

### Paso 3: Desplegar

Netlify desplegará automáticamente cuando hagas push a GitHub.

## 🔧 Desarrollo Local

```bash
# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm run dev

# Construir para producción
npm run build

# Previsualizar build de producción
npm run preview
```

## ⚠️ Notas Importantes

- La aplicación requiere una API key de Google Gemini para funcionar
- El archivo `.env.local` contiene la API key para desarrollo local (NO subir a Git)
- En producción, la API key se configura en las variables de entorno de Netlify
