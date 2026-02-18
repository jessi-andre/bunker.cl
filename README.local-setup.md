# Setup local (sin subir a GitHub todavía)

## 1) Instalar dependencias

```bash
npm install
```

## 2) Variables de entorno

1. Copia `.env.example` a `.env`
2. Completa claves de Stripe y Supabase

## 3) Crear tabla en Supabase

Ejecuta el SQL de `supabase/schema.sql`.

## 4) Crear productos de Stripe

Crea 3 precios de suscripción mensual y pega los `price_...` en:
- `STRIPE_PRICE_ID_STARTER`
- `STRIPE_PRICE_ID_PRO`
- `STRIPE_PRICE_ID_ELITE`

## 5) Ejecutar local

```bash
npm run dev
```

Esto levanta frontend + endpoints `/api/*` en local para probar checkout real en `http://localhost:3000`.

Opcional (si luego querés emular Vercel Functions exacto):

```bash
npm run dev:vercel
```

## Endpoints implementados

- `POST /api/create-checkout-session`
- `POST /api/create-portal-session`
- `POST /api/stripe-webhook`

## Eventos frontend

- `click_whatsapp`
- `select_plan`
- `begin_checkout`
- `purchase`

## Nota

No se hizo push a GitHub en este flujo. Todo queda local para revisión.
