// ============================================================
//  Los Excel de finanzas que Administración (grandbarmdz@) deja en Drive y
//  que se muestran en el Inicio de Dirección (franja "Finanzas").
//  Los usan dir-finanzas (lee los números) y estado-sistema (avisa si se
//  desactualizan). Un solo lugar para los IDs.
//
//  17/11/2026: desde el 20/10 Efectivo y Cheques se guardan en la subcarpeta
//  "Disponibilidad". Los archivos viejos de la carpeta principal quedaron en la
//  papelera con datos del 23/10, y el panel seguía leyendo esos. Si Administración
//  vuelve a reemplazar un archivo por uno nuevo (otro link), hay que cambiar el ID acá.
// ============================================================
module.exports = {
  efectivo: '1eaCvc0Z9zmZ-JWeDLA6QqxJzKR2x6S66',  // Disponibilidad / Efectivo.xlsx
  cheques:  '1qeTybv-a_8mLWdL9JyYoTx09nWpQPGb0',  // Disponibilidad / Cheques.xlsx
  pagos:    '120rJc8l7ohOOb-S7_lbBbSJ2sXXkttY-',  // Proceso_Pago_Proveedores.xlsx
  ordenes:  '1IK14iuaOZ7htMo1pH-hBfksTbuWn9G-c',  // Ordenes Compra activa.xlsx
  // SHARE / Comparativa Anual.xlsx (~31 MB). Fernando la baja desde Reportes › Archivos
  // (dir-archivos). Administración la actualiza, probablemente los lunes (17/11/2026).
  comparativa: '1i8mM7AzIx3Eeg2SNLwr6rMDen85uVNRp',
};
