# Backend de gestión de usuarios

API REST construida con Flask y PostgreSQL para la pantalla Angular/Fuse de Gestión de Usuarios.

## 1. Crear la base de datos

En PostgreSQL cree una base llamada `biblioteca` y ejecute `schema.sql`.

## 2. Configurar el proyecto (PowerShell)

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Edite `.env` con el usuario, contraseña, host, puerto y nombre reales de PostgreSQL.

## 3. Levantar la API

```powershell
python app.py
```

La API queda disponible en `http://localhost:5000`. Compruebe:

```text
http://localhost:5000/api/health
```

## Endpoints

| Método | Ruta | Acción |
|---|---|---|
| GET | `/api/users` | Listar y buscar usuarios (`?q=texto`) |
| GET | `/api/users/:id` | Consultar un usuario |
| POST | `/api/users` | Registrar usuario |
| PUT/PATCH | `/api/users/:id` | Editar usuario |
| PATCH | `/api/users/:id/status` | Activar o desactivar |
| DELETE | `/api/users/:id` | Eliminar usuario |

### Ejemplo para registrar

```json
{
  "id_temp": "USR-004",
  "email": "usuario@correo.com",
  "password": "clave123",
  "name": "Nuevo Usuario",
  "role": "user",
  "is_active": true
}
```

`password_hash` nunca se recibe ni se devuelve directamente: la API recibe `password`, la cifra y guarda únicamente el hash.

