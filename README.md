# Trabajo práctico 05

## Descripción
Este proyecto consiste en una aplicación web desarrollada con Node.js y Express destinada a la gestión y consulta de reservas de salas de estudio en una biblioteca. El objetivo principal del trabajo es implementar y organizar una arquitectura de software basada en un pipeline (cadena) de middlewares, garantizando el control, la identificación, la medición y la validación de las solicitudes HTTP antes de ejecutar las funciones finales de respuesta.

## Instalación
Para instalar las dependencias necesarias para este proyecto, ejecute el siguiente comando en su terminal:
```bash
npm install
```

## Ejecución
Para iniciar el servidor de desarrollo, utilice el comando configurado en los scripts del archivo `package.json`:
```bash
npm start
```
La aplicación estará disponible en la dirección: `http://localhost:3000`

## Rutas
El sistema implementa el siguiente contrato de rutas:
* `GET /` - Página de inicio con la bienvenida y explicación del propósito del sitio.
* `GET /estado` - Retorna un objeto en formato JSON con información técnica del estado actual del servicio.
* `GET /reservas` - Listado completo de todas las salas de estudio reservadas en el sistema.
* `GET /reservas/nueva` - Formulario HTML para la creación de una nueva solicitud de reserva.
* `GET /reservas/:id` - Vista de detalle correspondiente a una reserva específica identificada por su ID numérico único.
* `POST /reservas` - Endpoint encargado de procesar el formulario, validar los campos guardados en memoria y redirigir.

## Pipeline de middleware

### Diagrama de POST válido
Cuando un usuario completa el formulario de forma correcta, la solicitud atraviesa el siguiente recorrido:

```text
POST /reservas
 ↓ morgan("dev")
 ↓ identificarSolicitud
 ↓ medirDuracion
 ↓ expressLayouts
 ↓ express.urlencoded
 ↓ reservasRouter
 ↓ prepararAreaReservas
 ↓ validarReserva
 ↓ crearReserva
 ↓ 302 /reservas (Redirección)
 ↓ finish: ID + estado + duración (Log en consola)
```

### Diagrama de POST inválido
Cuando los datos ingresados no cumplen con las reglas del negocio, la solicitud se interrumpe tempranamente:

```text
POST /reservas
 ↓ morgan("dev")
 ↓ identificarSolicitud
 ↓ medirDuracion
 ↓ expressLayouts
 ↓ express.urlencoded
 ↓ reservasRouter
 ↓ prepararAreaReservas
 ↓ validarReserva (Detecta campos inválidos / vacíos)
 ↓ 400 Renderizar vista "reservas/nueva" (Finaliza el ciclo)
 ↓ finish: ID + estado + duración (Log en consola)
```
*Nota: En el caso inválido, la solicitud termina en la función middleware `validarReserva` con un código de estado HTTP 400, impidiendo que el flujo alcance al handler `crearReserva`.*

## Alcance de cada función

### Diferencia entre middleware incorporado, de terceros y personalizado
* **Middleware incorporado:** Son las funciones nativas provistas directamente por el framework Express. No requieren instalar paquetes externos adicionales. Un ejemplo es `express.urlencoded()`, encargado de interpretar los datos enviados a través de formularios HTML comerciales.
* **Middleware de terceros:** Son librerías externas desarrolladas por la comunidad que se descargan mediante npm e integran a la aplicación. Ejemplos de esto son `morgan`, utilizado para registrar los accesos técnicos en la terminal, y `express-ejs-layouts`, que gestiona las plantillas visuales reutilizables.
* **Middleware personalizado:** Son funciones escritas directamente por el desarrollador para cumplir una tarea específica y lógica del negocio. Un ejemplo dentro del proyecto son las funciones `identificarSolicitud` y `medirDuracion`.

### Cuándo se utiliza next()
La función `next()` se invoca cuando el middleware actual ha completado su responsabilidad con éxito y desea ceder el control al siguiente middleware o handler configurado en la pila de Express. Si no se llama a `next()` ni se envía una respuesta al cliente, la solicitud queda suspendida indefinidamente y el navegador del usuario se bloquea esperando una respuesta.

### Por qué los parsers aparecen antes de la validación
Los parsers (como `express.urlencoded` o `express.json`) deben registrarse en las primeras posiciones del pipeline porque son los encargados de interceptar el flujo binario de datos crudos que envía el cliente, procesarlos y adjuntarlos en un objeto legible dentro de `req.body`. Si la validación se ejecutara antes que los parsers, el objeto `req.body` estaría indefinido (`undefined`), impidiendo la lectura y análisis de los datos introducidos por el usuario.

### Diferencia entre alcance global, de router y de ruta
* **Alcance global:** El middleware se aplica a todas y cada una de las solicitudes recibidas por el servidor (incluyendo recursos estáticos, páginas válidas y errores 404). Se configuran mediante `app.use(middleware)`.
* **Alcance de router:** Las funciones afectan únicamente a los endpoints que pertenecen a un grupo modular específico de URLs. En este proyecto, `prepararAreaReservas` sólo se activa para los accesos que inician bajo el prefijo `/reservas`.
* **Alcance de ruta:** El middleware se inyecta de forma quirúrgica en un único endpoint y método específico. Un ejemplo es `validarReserva`, aplicado con exclusividad en la ruta `POST /reservas`.

### Motivo del evento finish
El evento `finish` pertenece al objeto de respuesta de Node.js (`res`). Se utiliza para registrar funciones de escucha (listeners) que se dispararán únicamente cuando la respuesta HTTP haya sido enviada por completo al cliente. Esto es fundamental para tareas de monitoreo como `medirDuracion`, ya que permite calcular de forma precisa el tiempo transcurrido desde el inicio de la solicitud hasta su finalización técnica, además de capturar el código de estado HTTP definitivo (como 200, 302 o 400).

### Resultado del montaje del router
Al montar `reservasRouter` mediante la instrucción `app.use("/reservas", reservasRouter)`, Express concatena el prefijo de montaje con las rutas internas declaradas de forma relativa. Esto significa que si dentro del router se define un método `.get("/nueva")`, la URL final expuesta al público se convierte en `GET /reservas/nueva`, evitando duplicar prefijos de manera redundante en el código.

### Diferencia entre el POST 302 y el GET posterior
* **POST 302 (Redirección):** Es la respuesta enviada por el servidor tras procesar un formulario exitoso. El código de estado 302 no contiene código HTML, sino que indica al navegador que la operación se completó y le ordena realizar de forma automática una nueva consulta hacia otra dirección.
* **GET posterior:** Es la nueva solicitud emitida por el navegador hacia la URL indicada en la redirección (en este caso, hacia `GET /reservas`). Este flujo responde un código de estado 200 y renderiza la estructura visual correspondiente a la lista de reservas actualizada. Este patrón es conocido como PRG (Post-Redirect-Get) y evita que el usuario duplique registros si refresca la pantalla de forma involuntaria.

### Motivo por el cual las altas desaparecen al reiniciar
Las altas desaparecen debido a que este proyecto almacena la colección de datos dentro de un arreglo en la memoria RAM del servidor (`reservasIniciales`). La memoria RAM es un medio de almacenamiento volátil; al apagar, interrumpir o reiniciar el proceso de Node.js en la terminal, los datos creados de manera dinámica se borran por completo, forzando a la aplicación a restablecer únicamente los valores iniciales codificados en el archivo de texto fuente al iniciar un nuevo ciclo de ejecución.

## Validación
El middleware `validarReserva` actúa como una barrera de seguridad en el servidor que evalúa los datos recibidos en el cuerpo de la solicitud (`req.body`). Aplica las siguientes reglas lógicas consecutivas:
1. Aplica `.trim()` sobre las cadenas de caracteres para eliminar espacios vacíos accidentales al inicio y final del texto.
2. Comprueba que los campos obligatorios como estudiante, email, sala y fecha no se encuentren vacíos.
3. Verifica mediante una condición lógica básica que el correo electrónico contenga el carácter `@`.
4. Controla que el nombre de la sala recibida pertenezca estrictamente al arreglo de opciones válidas (`salasPermitidas`).
5. Valida que el turno coincida de manera exacta con las opciones: `Mañana`, `Tarde` o `Noche`.
6. Convierte el valor de personas en un número e inspecciona que sea un número entero comprendido en el rango de 1 a 6.

Si alguna condición falla, la función interrumpe la cadena con un código `400` y vuelve a renderizar el formulario. Si todas las pruebas son superadas, genera el objeto estructurado dentro de `req.reservaValidada` y llama a `next()`.

## Pruebas manuales
El comportamiento y cumplimiento técnico de las rutas fue verificado manualmente a través del registro de accesos en consola empleando lo siguiente:
* Acceso a la página de bienvenida: Estado esperado `200 OK`.
* Consulta del estado del servicio en formato JSON: Estado esperado `200 OK`.
* Intento de envío de formulario con campos requeridos vacíos: Estado esperado `400 Bad Request` (Muestra cartel de alerta y conserva los datos ingresados).
* Intento de envío de formulario con cantidad de personas fuera de rango (ej. 7 personas): Estado esperado `400 Bad Request`.
* Creación de una reserva con todos los campos válidos: Estado esperado `302 Found` (Redirección inmediata al listado general).
* Solicitud de una ruta inexistente (ej. `/inventario`): Estado esperado `404 Not Found` (Renderiza la vista HTML personalizada).

## Persistencia temporal
Como se especifica en los requisitos de este trabajo práctico, el proyecto no utiliza mecanismos de persistencia permanente de datos en almacenamiento físico (como bases de datos relacionales o archivos semiestructurados `.json`) para el registro de las altas. La información se mantiene de forma estrictamente temporal en la memoria volátil del servidor durante su tiempo de ejecución activa.

Al interrumpir el proceso de Node.js en la terminal (mediante `Ctrl + C`) o al reiniciar el sistema, todas las nuevas reservas creadas por los usuarios se eliminan de manera definitiva. Al volver a iniciar la aplicación con `npm start`, el servidor restablece el arreglo en memoria recuperando únicamente las cuatro reservas definidas por defecto en el código fuente. Este comportamiento es un reflejo directo de trabajar con variables locales en el entorno de ejecución, cuya vida útil está ligada al ciclo de vida del proceso del servidor.