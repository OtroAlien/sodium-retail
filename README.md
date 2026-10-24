# Súper y Kiosco · Demo

Demo navegable del sistema de gestión para el kiosco minimarket y el supermercado de Mendoza
(propuesta Sodium v1.0, 22/10/2026). Cubre el MVP completo (M1 a M5) con datos ficticios y
servicios simulados, para mostrarle al cliente cómo va a funcionar antes del desarrollo.

> Es una demo de frontend: no hay servidor, base central ni conexión real con ARCA.
> Todo se guarda en el navegador del equipo.

## Cómo correrla

```bash
npm install
npm run dev
```

Abrir http://localhost:5173. Para la versión instalable (funciona sin internet):

```bash
npm run build
npm run preview
```

## Usuarios de prueba

| Usuario | Rol | Negocio | PIN |
|---|---|---|---|
| Martín Ferreyra | Administrador | Ambos | 1111 |
| Laura Quiroga | Encargado | Kiosco | 2222 |
| Diego Sosa | Cajero | Kiosco | 3333 |
| Sofía Herrera | Encargado | Supermercado | 4444 |
| Lucas Morales | Cajero | Supermercado | 5555 |
| Pablo Díaz | Cajero (bloqueado) | Supermercado | 6666 |

CUITs de prueba para Factura A: `30-71234567-1`, `20-30405060-9`, `30-70987654-2`.
`27-22233344-5` figura inactivo y ARCA rechaza la factura (para mostrar ese caso).

## Qué se puede mostrar

| Módulo | En la demo |
|---|---|
| M1 · Ventas y caja | Apertura con monto inicial, venta por búsqueda / lector USB / cámara, efectivo con vuelto, transferencia con cuenta destino, pago mixto, retiros e ingresos, cierre con esperado-contado-diferencia, reapertura (Encargado+), anulación con motivo y autorización por PIN, comprobante imprimible o por WhatsApp. |
| M2 · Catálogo y stock | Stock por lote con vencimiento, venta FEFO (primero el lote que vence antes), vencidos bloqueados, alertas con anticipación configurable, ajustes con motivo, precios editables en línea y masivos por %, historial de precios, rotación (vendidos 7 días y días de cobertura), importación CSV, asignación de código al escanear por primera vez. |
| M3 · Roles y auditoría | Tres roles con la matriz de la sección 06, usuarios bloqueados, auditoría de solo lectura con filtros, cierre de sesión por inactividad (15 min). |
| M4 · Sin conexión | Indicador de estado, cola local visible, persistencia ante recarga, sincronización automática al volver internet, conciliación de stock entre dos cajas sumando movimientos. Service worker para abrir la app sin red. |
| M5 · Facturación ARCA | Factura A (con consulta de CUIT) y B, CAE y QR con el formato de ARCA, numeración por punto de venta, contingencia con reintento automático, notas de crédito por anulación, estados emitido / pendiente / rechazado. |
| A3 (vista previa) | Tabla de ambos negocios en el inicio del Administrador. |

El botón violeta **Demo** permite cortar internet, simular que ARCA no responde y reiniciar los datos.

### Recorrido sugerido

1. Entrar como **Diego (cajero)**, abrir la caja y vender con Factura B: aparece el CAE y el QR.
2. En **Demo**, cortar internet. Vender en efectivo: la venta se guarda y la factura queda pendiente.
3. En **Sincronización**, simular una venta del mismo producto en la Caja 2. Recargar la página: nada se pierde.
4. Volver a conectar: se sincroniza la cola, se concilia el stock y la factura obtiene su CAE.
5. Intentar anular una venta como cajero: pide PIN de un Encargado (Laura, 2222).
6. Entrar como **Martín (admin)**: costos y márgenes, auditoría, usuarios y la vista de ambos negocios.

## Stack

React 19 + TypeScript + Vite + Tailwind CSS 4 + Zustand (persistido en `localStorage`).

```
src/
  store.ts          estado y reglas de negocio (M1-R1 ... M5-R4 comentadas en el código)
  data/seed.ts      negocios, usuarios, productos, lotes y ventas históricas de ejemplo
  lib/arca.ts       simulación de ARCA: validación de CUIT, padrón, CAE y QR
  lib/permissions.ts matriz de permisos por rol
  pages/            una pantalla por sección
public/sw.js        service worker para uso sin internet
```
