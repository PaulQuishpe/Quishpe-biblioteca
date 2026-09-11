import os
import uuid
from datetime import datetime

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from werkzeug.security import generate_password_hash

load_dotenv()

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Uuid, primary_key=True, default=uuid.uuid4)
    id_temp = db.Column(db.Text, nullable=True)
    email = db.Column(db.Text, nullable=False, unique=True)
    password_hash = db.Column(db.Text, nullable=True)
    name = db.Column(db.Text, nullable=False)
    role = db.Column(db.Text, nullable=False, default="user")
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": str(self.id),
            "id_temp": self.id_temp,
            "email": self.email,
            "name": self.name,
            "role": self.role,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat(timespec="milliseconds"),
        }


def error(message, status=400, details=None):
    body = {"message": message}
    if details:
        body["details"] = details
    return jsonify(body), status


def normalize_payload(payload, partial=False):
    allowed = {"id_temp", "email", "password", "name", "role", "is_active"}
    data = {key: value for key, value in payload.items() if key in allowed}
    errors = {}

    if not partial:
        for field in ("email", "name", "password"):
            if not str(data.get(field, "")).strip():
                errors[field] = "Este campo es obligatorio."

    if "email" in data:
        data["email"] = str(data["email"]).strip().lower()
        if "@" not in data["email"]:
            errors["email"] = "Ingrese un correo válido."

    if "name" in data:
        data["name"] = str(data["name"]).strip()
        if not data["name"]:
            errors["name"] = "El nombre no puede estar vacío."

    if "id_temp" in data:
        value = str(data["id_temp"]).strip() if data["id_temp"] is not None else ""
        data["id_temp"] = value or None

    if "role" in data and data["role"] not in ("admin", "user"):
        errors["role"] = "El rol debe ser admin o user."

    if "is_active" in data and not isinstance(data["is_active"], bool):
        errors["is_active"] = "El estado debe ser true o false."

    if "password" in data:
        password = str(data["password"])
        if password and len(password) < 6:
            errors["password"] = "La contraseña debe tener al menos 6 caracteres."
        elif not password and partial:
            data.pop("password")

    return data, errors


def create_app(test_config=None):
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://postgres:postgres@localhost:5432/biblioteca",
    )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    if test_config:
        app.config.update(test_config)

    db.init_app(app)
    CORS(
        app,
        resources={r"/api/*": {"origins": os.getenv("FRONTEND_ORIGIN", "http://localhost:3873")}},
    )

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok"})

    @app.get("/api/users")
    def list_users():
        query = User.query
        search = request.args.get("q", "").strip()
        if search:
            pattern = f"%{search}%"
            query = query.filter(
                or_(
                    User.name.ilike(pattern),
                    User.email.ilike(pattern),
                    User.id_temp.ilike(pattern),
                    User.role.ilike(pattern),
                )
            )
        users = query.order_by(User.created_at.desc()).all()
        return jsonify([user.to_dict() for user in users])

    @app.get("/api/users/<uuid:user_id>")
    def get_user(user_id):
        user = db.session.get(User, user_id)
        if not user:
            return error("Usuario no encontrado.", 404)
        return jsonify(user.to_dict())

    @app.post("/api/users")
    def create_user():
        data, errors = normalize_payload(request.get_json(silent=True) or {})
        if errors:
            return error("Revise los datos enviados.", 422, errors)

        user = User(
            id_temp=data.get("id_temp"),
            email=data["email"],
            password_hash=generate_password_hash(data["password"]),
            name=data["name"],
            role=data.get("role", "user"),
            is_active=data.get("is_active", True),
        )
        db.session.add(user)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            return error("Ya existe un usuario con ese correo.", 409)
        return jsonify(user.to_dict()), 201

    @app.route("/api/users/<uuid:user_id>", methods=["PUT", "PATCH"])
    def update_user(user_id):
        user = db.session.get(User, user_id)
        if not user:
            return error("Usuario no encontrado.", 404)

        # En edición la contraseña es opcional, tanto con PUT como con PATCH.
        data, errors = normalize_payload(request.get_json(silent=True) or {}, partial=True)
        if errors:
            return error("Revise los datos enviados.", 422, errors)

        for field in ("id_temp", "email", "name", "role", "is_active"):
            if field in data:
                setattr(user, field, data[field])
        if "password" in data:
            user.password_hash = generate_password_hash(data["password"])

        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            return error("Ya existe un usuario con ese correo.", 409)
        return jsonify(user.to_dict())

    @app.patch("/api/users/<uuid:user_id>/status")
    def update_status(user_id):
        user = db.session.get(User, user_id)
        if not user:
            return error("Usuario no encontrado.", 404)
        payload = request.get_json(silent=True) or {}
        if not isinstance(payload.get("is_active"), bool):
            return error("is_active debe ser true o false.", 422)
        user.is_active = payload["is_active"]
        db.session.commit()
        return jsonify(user.to_dict())

    @app.delete("/api/users/<uuid:user_id>")
    def delete_user(user_id):
        user = db.session.get(User, user_id)
        if not user:
            return error("Usuario no encontrado.", 404)
        db.session.delete(user)
        db.session.commit()
        return "", 204

    return app


app = create_app()

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.getenv("PORT", "5000")),
        debug=os.getenv("FLASK_DEBUG", "false").lower() == "true",
    )
