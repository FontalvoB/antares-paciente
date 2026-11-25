# KAN-170 · Solicitudes de privacidad al servidor

En Perfil → Privacidad y datos, la tarjeta **Tus datos en el servidor** aparece
si Auth tiene habilitado el canal para una sesión de app activa. El titular puede
solicitar copia JSON o CSV, o confirmar el envío de una solicitud de borrado.
La app muestra el comprobante que guarda Auth y lo recupera al reabrir la pantalla.

Si Auth habilita la descarga acotada, el titular puede descargar su perfil y
signos vitales en el formato que solicitó. La UI distingue esa descarga de la
copia completa y la solicitud permanece pendiente. El comprobante no borra datos
ni cierra la cuenta. Los controles de este dispositivo de KAN-157 son
independientes y no cambian con este trabajo.

La prueba `e2e/privacy-requests.mjs` usa un Auth y un PostgreSQL locales
descartables con los fixtures del backend en `scripts/qa/kan-170`. Las
instrucciones y los requisitos restantes están en
`docs/modules/privacy/README.md` del backend.

Cuando un operador ERP publica una copia revisada con cobertura de todas las
categorías, la app la ofrece en el formato solicitado. Un comprobante de
recepción o una descarga acotada no cuenta como entrega integral. La copia
integral cierra el trámite al servirse por primera vez y puede volver a
descargarse hasta la fecha de vencimiento.
