# Gestión de negocios · Demo

Demo comercial de la plataforma para los cuatro negocios del cliente en Mendoza: **kiosco**,
**supermercado**, **ferretería** y **alquiler de esquí y snowboard**. Cubre el MVP de la propuesta
Sodium v1.0 (M1 a M5), los add-ons (A1 a A4) y los dos rubros de la sección 19, con datos de ejemplo
y servicios externos simulados.

> Es una demo de frontend: no hay servidor, base central, ARCA, Mercado Pago, WhatsApp, email ni IA reales.
> Todo se guarda en el navegador. Las acciones simuladas están marcadas en pantalla con la etiqueta violeta “Simulado”.

## Cómo correrla

```bash
npm install
npm run dev
```

Abrir http://localhost:5173. Versión de producción (la usa Railway):

```bash
npm run build
npm start
```

## Usuarios de prueba

| Usuario | Rol | Negocio | PIN |
|---|---|---|---|
| Martín Ferreyra | Administrador | Todos (panel general) | 1111 |
| Laura Quiroga / Diego Sosa | Encargado / Cajero | Kiosco | 2222 / 3333 |
| Sofía Herrera / Lucas Morales | Encargado / Cajero | Supermercado | 4444 / 5555 |
| Pablo Díaz | Cajero bloqueado | Supermercado | 6666 |
| Rubén Gil / Carla Ortiz | Encargado / Cajera con descuento habilitado | Ferretería | 7777 / 8888 |
| Nicolás Vera / Julieta Ríos | Encargado / Cajera | Ski & Snowboard | 9999 / 1234 |

CUITs de prueba para Factura A: `30-71234567-1`, `20-30405060-9`, `30-70987654-2`. `27-22233344-5` figura inactivo
y ARCA rechaza la factura.

## Qué incluye

**Común a todos los negocios:** caja con apertura y cierre, ventas, Factura A/B y notas de crédito con CAE y QR,
contingencia de ARCA, modo sin conexión con sincronización, clientes con historial y cuenta corriente,
cobros con tarjeta y QR (terminal simulada, aprobado/rechazado), conciliación de Mercado Pago, reportes con
exportación a CSV, oportunidades de venta, automatizaciones con bandeja de mensajes, asistente de consultas,
usuarios por negocio con permisos ajustables y auditoría.

**Kiosco y supermercado:** stock por lote con vencimientos, venta del lote más próximo a vencer,
promociones automáticas por vencimiento, proveedores, compras y reposición sugerida.

**Ferretería:** productos con variantes (medidas, colores, talles) y unidades de venta (unidad, caja x100,
metro, rollo, kilo), presupuestos con precios congelados que se convierten en venta, seguimiento automático,
cuentas corrientes de empresas y profesionales, reposición por proveedor más barato.

**Ski & Snowboard:** inventario por unidad y talle, disponibilidad por fechas, reservas con seña,
talles guardados por cliente, entrega con depósito en garantía (efectivo o preautorización),
devolución con revisión de estado, recargos por demora y por daños, limpieza y mantenimiento,
ocupación por tipo de equipo y preventa para clientes de la temporada pasada.

**Panel general (Administrador):** ventas de los cuatro negocios, comparación, márgenes, cuentas a cobrar
y a pagar, alertas consolidadas con acceso directo al detalle, estado del sistema y resumen diario.

## Recorridos sugeridos

1. **Dueño** (Martín, 1111): panel general → comparación y alertas → “Ver detalle” de un negocio.
2. **Ski & Snowboard** (Nicolás, 9999): Mostrador → abrir caja → entregar una reserva de hoy → recibir la
   atrasada marcando un daño → Disponibilidad → tocar un casillero y reservar para un cliente con talles guardados.
3. **Ferretería** (Rubén, 7777): Vender → tornillos por caja x100 y cable por metro → cliente con cuenta
   corriente → Factura A automática. Presupuestos → convertir uno en venta.
4. **Kiosco** (Diego, 3333): cortar internet desde el panel Demo, vender en efectivo, reconectar y ver la
   sincronización. Con Laura (2222): Oportunidades → liquidar productos por vencer y ver el precio promo en caja.
5. **Automatizaciones**: ejecutar reposición, recordatorios y resumen diario, y revisar los mensajes enviados.

El botón **Demo** permite cortar internet, simular que ARCA no responde y reiniciar los datos.

## Estructura

```
src/
  store/        estado y reglas de negocio, separado por dominio (caja y ventas, catálogo,
                compras, clientes y presupuestos, alquiler, automatizaciones, sincronización)
  data/         negocios, usuarios, catálogos, clientes, proveedores, inventario de alquiler e historial
  lib/          ARCA simulado, permisos, reglas de alquiler, indicadores, oportunidades y asistente
  pages/        una pantalla por sección
server.mjs      servidor de producción sin dependencias (Railway)
public/sw.js    service worker para uso sin internet
```
