-- base de datos de SVAD. Para importar: phpMyAdmin > Importar > elegir este archivo
CREATE DATABASE IF NOT EXISTS svad_web
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE svad_web;

-- se borran las tablas para poder importar el archivo mas de una vez
DROP TABLE IF EXISTS consultas;
DROP TABLE IF EXISTS servicios;
DROP TABLE IF EXISTS administradores;

-- usuarios del panel (la contraseña se guarda como hash)
CREATE TABLE administradores (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario       VARCHAR(50)  NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  creado_en     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_administradores_usuario (usuario)
) ENGINE=InnoDB;

-- servicios del sitio (precio NULL = consultar)
CREATE TABLE servicios (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  nombre      VARCHAR(100)  NOT NULL,
  descripcion TEXT          NOT NULL,
  area        ENUM('hardware','redes','asistencia','datos') NOT NULL,
  icono       VARCHAR(30)   NOT NULL,
  precio      DECIMAL(10,2) NULL,
  orden       TINYINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- consultas del formulario de contacto (leida: 0 no leida, 1 leida)
CREATE TABLE consultas (
  id       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre   VARCHAR(100) NOT NULL,
  email    VARCHAR(150) NOT NULL,
  telefono VARCHAR(30)  NULL,
  asunto   VARCHAR(150) NOT NULL,
  mensaje  TEXT         NOT NULL,
  leida    TINYINT(1)   NOT NULL DEFAULT 0,
  fecha    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_consultas_leida (leida),
  KEY idx_consultas_fecha (fecha)
) ENGINE=InnoDB;

-- datos iniciales
INSERT INTO administradores (usuario, password_hash) VALUES
('admin', '8f1a161339ffd69f43ec8a75f3cd983b:b59c590ace871bf56bac1ba18f1d5410c4294c96855aba56bff0bc2e426462cd4815cdbb2d806591c7bdb52329cc9d60d3568ea0dc8385291a3cfd3376977fe6');

INSERT INTO servicios (nombre, descripcion, area, icono, precio, orden) VALUES
('Diagnóstico y reparación de equipos',
 'Pruebas de fuente, memoria RAM, disco (estado SMART) y temperaturas para encontrar la causa real antes de cambiar piezas. Reparamos y reemplazamos los componentes dañados.',
 'hardware', 'chip', NULL, 1),
('Mantenimiento preventivo',
 'Limpieza interna, cambio de pasta térmica, control de ventiladores y conexiones y revisión de discos, según un calendario acordado con vos.',
 'hardware', 'mantenimiento', NULL, 2),
('Mejoras y upgrades',
 'Cambio de disco HDD por SSD, ampliación de RAM y asesoramiento de compra según tu uso y tu presupuesto.',
 'hardware', 'mejoras', NULL, 3),
('Diseño y cableado de redes',
 'Plano de instalación, esquema lógico, cableado UTP categoría 6, patch panel y rack. Todo documentado y probado punto por punto.',
 'redes', 'red', NULL, 4),
('Wi-Fi y seguridad de la red',
 'Buena cobertura, cifrado WPA2/WPA3, red separada para invitados, segmentación con VLAN, reglas de firewall y firmware actualizado.',
 'redes', 'wifi', NULL, 5),
('Soporte remoto y presencial',
 'Atención por WhatsApp, teléfono o correo. Resolvemos a distancia cuando se puede y vamos al lugar cuando hace falta, con seguimiento posterior.',
 'asistencia', 'soporte', NULL, 6),
('Capacitaciones y guías',
 'Talleres cortos sobre programas de oficina, contraseñas seguras, phishing y copias de seguridad, más instructivos paso a paso con capturas.',
 'asistencia', 'capacitacion', NULL, 7),
('Copias de seguridad y recuperación de datos',
 'Backups programados con la regla 3-2-1, pruebas de restauración, recuperación de archivos borrados y monitoreo. Es nuestra especialidad.',
 'datos', 'datos', NULL, 8);

-- consultas de ejemplo
INSERT INTO consultas (nombre, email, telefono, asunto, mensaje, leida, fecha) VALUES
('Lucía Fernández', 'lucia.fernandez@example.com', '2964 555-0101',
 'Presupuesto de red para oficina',
 'Hola, tenemos una oficina de 8 puestos y queremos ordenar el cableado y el Wi-Fi. ¿Pueden pasar a hacer un relevamiento y enviarnos un presupuesto?',
 0, '2026-09-24 10:15:00'),
('Martín Gómez', 'martin.gomez@example.com', NULL,
 'Recuperar archivos de un disco',
 'Mi disco externo dejó de aparecer en la computadora y tiene fotos de la familia. ¿Es posible recuperarlas? Gracias.',
 0, '2026-09-26 18:40:00'),
('Escuela N° 12', 'secretaria@example.com', '2964 555-0102',
 'Capacitación sobre phishing',
 'Nos interesa una charla corta para el personal docente sobre correos falsos y contraseñas seguras. ¿Qué disponibilidad tienen en octubre?',
 1, '2026-09-20 09:05:00'),
('Camila Rojas', 'camila.rojas@example.com', '2964 555-0103',
 'Cambio de disco a SSD',
 'Mi notebook tarda mucho en arrancar. ¿Conviene cambiar el disco por un SSD? ¿Cuánto tiempo demora el trabajo?',
 1, '2026-09-22 15:30:00');
