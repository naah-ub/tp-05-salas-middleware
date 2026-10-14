const express = require("express");
const expressLayouts = require("express-ejs-layouts");
const morgan = require("morgan");
const path = require("node:path");

const PORT = 3000;

// Salas
const salasPermitidas = ["Sala Norte", "Sala Sur", "Sala Multimedia"];

// Datos iniciales
const reservasIniciales = [
    {
        id: 1,
        estudiante: "Juan Pérez",
        email: "juan.perez@email.com",
        sala: "Sala Norte", 
        fecha: "2026-10-15",
        turno: "Mañana",
        personas: 3
    },
    {
        id: 2,
        estudiante: "María López",
        email: "maria.lopez@email.com",
        sala: "Sala Sur", 
        fecha: "2026-10-15",
        turno: "Tarde",
        personas: 1
    },
    {
        id: 3,
        estudiante: "Carlos Gómez",
        email: "carlos.gomez@email.com",
        sala: "Sala Multimedia", 
        fecha: "2026-10-16",
        turno: "Noche",
        personas: 6
    },
    {
        id: 4,
        estudiante: "Ana Rodríguez",
        email: "ana.rodri@email.com",
        sala: "Sala Norte", 
        fecha: "2026-10-17",
        turno: "Tarde",
        personas: 4
    }
];

// MIDDLEWARE

// Contador de la cantidad de solicitudes 
let numeroDeSolicitud = 0;

// Cantidad de solicitudes que van llegando
function identificarSolicitud(req, res, next) {
    numeroDeSolicitud += 1;
    res.locals.solicitudId = `BIB-${String(numeroDeSolicitud).padStart(4, "0")}`;
    next();
}

// Define una constante, va a guardar una hora de inicio y una hora de fin 
// va a dar como respuesta la diferencia entre esos valores
function medirDuracion(req, res, next) {
    const inicio = process.hrtime.bigint();
    res.on("finish", () => {
        const fin = process.hrtime.bigint();
        const milisegundos = Number(fin - inicio) / 1_000_000;
        console.log(
            `[${res.locals.solicitudId}] ${req.method} ${req.originalUrl} ` +
            `${res.statusCode} ${milisegundos.toFixed(2)} ms`,
        );
    });
    next();
}

// Coloca el texto en la seccion
function prepararAreaReservas(req, res, next) {
    res.locals.seccion = "Reservas de salas";
    next();
}

// Va a tomar el cuerpo de la solicitud y transforma esos valores en datos validos, o revisa que los datos sean validos
// function ValidadProducto(req, res, next) {
//     const nombre = String(req.body.nombre ?? "").trim();
//     const categoria = String(req.body.categoria ?? "").trim();
//     const descripcion = String(req.body.descripcion ?? "").trim();
//     const precio = Number(req.body.precio);
//     if (!nombre || !categoria || !descripcion || !Number.isFinite(precio) || precio <= 0) {
//         return res.status(400).render("productos/nuevo", {
//             titulo: "Nuevo producto",
//             error: "Completá todos los campos con valores válidos.",
//             valores: req.body,
//         });
//     }
//     req.productoValidado = { nombre, categoria, precio, descripcion };
//     next();
// }

function validarReserva(req, res, next) {
    const estudiante = String(req.body.estudiante ?? "").trim();
    const email = String(req.body.email ?? "").trim();
    const sala = String(req.body.sala ?? "").trim();
    const fecha = String(req.body.fecha ?? "").trim();
    const turno = String(req.body.turno ?? "").trim();
    const personas = Number(req.body.personas);

    const turnosPermitidos = ["Mañana", "Tarde", "Noche"];

    // Validaciones estrictas del contrato del TP
    if (
        !estudiante || 
        !email || !email.includes("@") || 
        !sala || !salasPermitidas.includes(sala) || 
        !fecha || 
        !turno || !turnosPermitidos.includes(turno) || 
        !Number.isInteger(personas) || personas < 1 || personas > 6
    ) {
        // Detiene el ciclo con estado 400 y vuelve a renderizar el formulario conservando valores
        return res.status(400).render("reservas/nueva", {
            titulo: "Nueva reserva",
            error: "Completá todos los campos con valores válidos.",
            valores: req.body, // Permite conservar los valores en los inputs
        });
    }

    // Si todo es válido, preparamos el objeto limpio y continuamos
    req.reservaValidada = { estudiante, email, sala, fecha, turno, personas };
    next();
}

function crearReserva(req, res) {
    const ultimoId = reservasIniciales.reduce(
        (mayorId, reserva) => Math.max(mayorId, reserva.id),
        0,
    );
    
    reservasIniciales.push({ 
        id: ultimoId + 1, 
        ...req.reservaValidada 
    });

    res.redirect("/reservas");
}

async function main() {
    const app = express();

    // function crearProducto(req, res) {
    //     const ultimoId = productos.reduce(
    //         (mayorId, producto) => Math.max(mayorId, producto.id),
    //         0,
    //     );
    //     productos.push({ id: ultimoId + 1, ...req.productoValidado });
    //     res.redirect("/productos");
    // }

    // Configuracion de plantillas y vistas
    app.set("view engine", "ejs");
    app.set("views", path.join(__dirname, "..", "views"));
    app.set("layout", "layouts/main");

    // Middleware
    app.use(morgan("dev"));
    app.use(identificarSolicitud);
    app.use(medirDuracion);
    app.use(expressLayouts);
    app.use(express.static(path.join(__dirname, "..", "public")));
    app.use(express.urlencoded({ extended: false }));
    app.use(express.json());

    // Rutas
    app.get("/", (req, res) => {
        res.render("inicio", { titulo: "Sistema de Reservas" });
    });

    app.get("/estado", (req, res) => {
        res.json({
            servicio: "activo",
            reservas: reservasIniciales.length,
            solicitudId: res.locals.solicitudId
        });
    });

    // Router
    const reservasRouter = express.Router();
    reservasRouter.use(prepararAreaReservas);

    // Listado de reservas
    reservasRouter.get("/", (req, res) => {
        res.render("reservas/lista", {
            titulo: "Listado de reservas",
            reservas: reservasIniciales,
        });
    });

    // Formulario
    reservasRouter.get("/nueva", (req, res) => {
        res.render("reservas/nueva", {
            titulo: "Nueva reservas",
            error: null,
            valores: {},
        });
    });

    reservasRouter.get("/:id", (req, res) => {
        const id = Number(req.params.id);
        const reserva = reservasIniciales.find((elemento) => elemento.id === id);

        if (!reserva) {
            return res.status(404).render("no-encontrado", {
                titulo: "Reserva no encontrada",
                mensaje: "No existe una reserva con ese identificador.",
            });
        }

        res.render("reservas/detalle", {
            titulo: `Reserva #${reserva.id}`,
            reserva,
        });
    });

    reservasRouter.post("/", validarReserva, crearReserva);
    app.use("/reservas", reservasRouter);

    // Manejo de erorr
    app.use((req, res) => {
        res.status(404).render("no-encontrado", {
            titulo: "Página no encontrada",
            mensaje: "La dirección solicitada no existe.",
        });
    });

    app.listen(PORT, () => {
        console.log(`Aplicación disponible en http://localhost:${PORT}`);
    });
}

main().catch((error) => {
    console.error("No se pudo iniciar la aplicación:", error);
    process.exitCode = 1;
});
