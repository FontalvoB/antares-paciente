// Muestra exclusiva de la vista de desarrollo; nunca se añade al onboarding normal.
export const CONSENT_SCROLL_TEST_SECTIONS = [
  {
    "title": "1. Lectura del documento",
    "body": "Este es un bloque temporal para probar la lectura de un documento extenso. El párrafo original permanece al comienzo. Desliza lentamente dentro de este recuadro para avanzar por las secciones. Durante la prueba, observa que las casillas de aceptación siguen deshabilitadas mientras todavía queda texto por leer. No necesitas mantener presionado ningún botón ni esperar una cuenta regresiva: el cambio depende de llegar al final del contenido."
  },
  {
    "title": "2. Desplazamiento dentro del recuadro",
    "body": "El texto tiene su propio espacio de lectura. Mover la pantalla completa para ver los botones no equivale a recorrer el documento. Para esta comprobación, coloca el dedo sobre los párrafos y desliza hacia arriba. Puedes detenerte a mitad de camino, volver a una sección anterior o leer a tu ritmo. Mientras el final no esté visible, la aceptación debe continuar bloqueada."
  },
  {
    "title": "3. Comprobación de las casillas",
    "body": "Las tres casillas son decisiones independientes. El recorrido del texto no debe marcarlas automáticamente. Al terminar la lectura se habilitan para que puedas seleccionarlas de forma individual. Esta sección añade longitud suficiente para observar la diferencia entre llegar a la mitad del documento y alcanzar la última línea. Continúa desplazándote dentro del recuadro para completar esa comprobación."
  },
  {
    "title": "4. Lectura en el teléfono",
    "body": "Puedes hacer esta prueba con el tamaño de letra y la orientación que uses normalmente. Verifica que el documento se pueda desplazar con un gesto vertical y que el resto del formulario siga siendo fácil de usar. Si cambias la orientación, vuelve a observar la ubicación del final del texto. La intención es comprobar el comportamiento real del recuadro de lectura en tu teléfono."
  },
  {
    "title": "5. Antes de llegar al final",
    "body": "Todavía hay más contenido debajo de este párrafo. Detén el desplazamiento en este punto y comprueba que las casillas no se puedan seleccionar. El botón Continuar también debe permanecer deshabilitado. Después, retoma la lectura desde donde quedaste. No hay un tiempo mínimo de espera: esta prueba se centra únicamente en reconocer cuándo has alcanzado el final visible del documento."
  },
  {
    "title": "6. Aceptación manual",
    "body": "Cuando llegues al final, el mensaje de estado indicará que ya puedes aceptar el consentimiento. Las casillas deben aparecer habilitadas, pero seguir sin marcar. Selecciona primero una y después otra para comprobar que el botón Continuar todavía espera la tercera. Solo después de seleccionar las tres opciones debe quedar disponible el siguiente paso. Puedes desmarcar una casilla para verificar que el botón vuelva a deshabilitarse."
  },
  {
    "title": "7. Repetición de la prueba",
    "body": "En la vista de prueba puedes usar Reiniciar prueba para volver al comienzo. Esto limpia las casillas y bloquea otra vez la aceptación, de modo que puedes repetir el recorrido tantas veces como necesites. En el formulario normal, volver desde el paso siguiente debe conservar la lectura y las opciones que ya seleccionaste durante la misma sesión."
  },
  {
    "title": "8. Última sección de prueba",
    "body": "Esta es la última sección antes del indicador final. Continúa un poco más para que se vea completamente el cierre del documento. El contenido adicional se añadió solo para revisar el desplazamiento y se retirará cuando termine la prueba. El texto original se conserva al principio para poder restaurar la versión habitual sin reconstruirlo ni cambiar las opciones de aceptación."
  }
] as const;
