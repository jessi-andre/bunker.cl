# Hardening de producción (Bunker)

Este documento describe pruebas manuales y variables para las fases aplicadas sin cambiar arquitectura.

## Variables de entorno sugeridas

- `SESSION_MAX_AGE_SECONDS` (default: 604800)
- `SESSION_SLIDING_THRESHOLD_SECONDS` (default: 21600)
- `SESSION_ABSOLUTE_MAX_SECONDS` (default: 2592000)
- `SESSION_USER_AGENT_MODE` (`soft` | `hard`, default: `soft`)
- `LOGIN_INVALIDATE_PREVIOUS_SESSIONS` (`true` | `false`)
- `SESSION_CLEANUP_SECRET` (requerido para `/api/cleanup-sessions`)

## Fase 1: Headers + CORS + cookie

### Verificar headers de seguridad

```bash
curl -i https://TU-DOMINIO/api/test-cookie
```

Debe incluir:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy`
- `Content-Security-Policy`

### Verificar CORS estricto

```bash
curl -i -X POST https://TU-DOMINIO/api/logout \
  -H "Origin: https://evil.example" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Debe responder `403 Origin not allowed`.

### Cookie HttpOnly/Secure

Inicia sesión y revisa en DevTools -> Application -> Cookies:
- `bunker_session` con `HttpOnly`
- `SameSite=Lax`
- `Secure` en producción

## Fase 2: Tenant por dominio

- Inicia sesión en tenant A.
- Repite request a endpoint autenticado usando host de tenant B.
- Debe responder `403 Tenant mismatch`.

## Fase 3: Sliding + cleanup

### Sliding
- Ajusta temporalmente `SESSION_SLIDING_THRESHOLD_SECONDS=999999`.
- Llama `/api/test-cookie`.
- Verifica en DB que `expires_at` se extendió y `last_seen_at` cambió.

### Cleanup

```bash
curl -i -X POST https://TU-DOMINIO/api/cleanup-sessions \
  -H "Content-Type: application/json" \
  -H "x-cleanup-secret: TU_SECRET" \
  -d '{}'
```

Debe devolver `{ ok: true, deleted: N }`.

## Fase 4: Revocación global

### Revocar mis sesiones

```bash
curl -i -X POST https://TU-DOMINIO/api/revoke-my-sessions \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: TOKEN" \
  -b "bunker_session=...; bunker_csrf=TOKEN" \
  -d '{}'
```

### Revocar sesiones de compañía

```bash
curl -i -X POST https://TU-DOMINIO/api/revoke-company-sessions \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: TOKEN" \
  -b "bunker_session=...; bunker_csrf=TOKEN" \
  -d '{}'
```

Si existe columna `role`, solo `owner/superadmin` pasan.

## Fase 5: CSRF

### Obtener token

```bash
curl -i https://TU-DOMINIO/api/csrf
```

Devuelve `{ csrfToken }` y cookie `bunker_csrf`.

### Mutación sin CSRF

```bash
curl -i -X POST https://TU-DOMINIO/api/logout \
  -H "Content-Type: application/json" \
  -b "bunker_session=..." \
  -d '{}'
```

Debe devolver `403`.

## Fase 6: Rate limiting login

- Repite login con password incorrecta varias veces para el mismo `ip+email`.
- Debe comenzar a devolver `429` por lockout.
- Mensaje se mantiene uniforme: `Credenciales inválidas`.

## Fase 7: Stripe + gating

- Verifica en DB `company_subscriptions` tras webhook de:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
  - `invoice.paid`
- En estado no activo (`past_due`, `unpaid`, `canceled`), `/api/create-portal-session` debe devolver `402` con `code: PLAN_INACTIVE`.

## Fase 8: Logging

- Revisar logs de Vercel: salida JSON con `request_id`, `route`, `company_id`, `admin_id`, `result`.
- Revisar tabla opcional `audit_logs` para rechazos de tenant/csrf/login.
