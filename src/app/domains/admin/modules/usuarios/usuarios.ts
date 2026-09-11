import { DatePipe } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

interface UsuarioApi {
    id: string;
    id_temp: string | null;
    email: string;
    name: string;
    role: string;
    is_active: boolean;
    created_at: string;
}

interface Usuario {
    id: string;
    id_temp: string | null;
    email: string;
    name: string;
    role: string;
    is_active: boolean;
    created_at: Date;
}

interface FormularioUsuario {
    id_temp: string;
    email: string;
    password: string;
    name: string;
    role: string;
    is_active: boolean;
}

const FORMULARIO_INICIAL: FormularioUsuario = {
    id_temp: '',
    email: '',
    password: '',
    name: '',
    role: 'user',
    is_active: true,
};

@Component({
    selector: 'app-usuarios',
    standalone: true,
    imports: [
        DatePipe,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule,
        MatSlideToggleModule,
        MatTableModule,
        MatTooltipModule,
    ],
    templateUrl: './usuarios.html',
})
export class UsuariosComponent implements OnInit {
    private readonly http = inject(HttpClient);
    private readonly apiUrl = 'http://localhost:5000/api/users';

    readonly busqueda = signal('');
    readonly mostrarFormulario = signal(false);
    readonly usuarioEditandoId = signal<string | null>(null);
    readonly mensaje = signal('');
    readonly cargando = signal(false);

    readonly formulario = signal<FormularioUsuario>({
        ...FORMULARIO_INICIAL,
    });

    readonly columnas: string[] = [
        'id_temp',
        'name',
        'email',
        'role',
        'is_active',
        'created_at',
        'acciones',
    ];

    // Los usuarios ahora vienen de PostgreSQL.
    readonly usuarios = signal<Usuario[]>([]);

    readonly usuariosFiltrados = computed(() => {
        const texto = this.busqueda().toLowerCase().trim();

        if (!texto) {
            return this.usuarios();
        }

        return this.usuarios().filter((usuario) => {
            return (
                usuario.name.toLowerCase().includes(texto) ||
                usuario.email.toLowerCase().includes(texto) ||
                usuario.role.toLowerCase().includes(texto) ||
                usuario.id_temp?.toLowerCase().includes(texto) ||
                usuario.id.toLowerCase().includes(texto)
            );
        });
    });

    readonly totalUsuarios = computed(() => this.usuarios().length);

    readonly totalActivos = computed(
        () => this.usuarios().filter((usuario) => usuario.is_active).length
    );

    readonly totalInactivos = computed(
        () => this.usuarios().filter((usuario) => !usuario.is_active).length
    );

    readonly tituloFormulario = computed(() =>
        this.usuarioEditandoId()
            ? 'Editar usuario'
            : 'Registrar nuevo usuario'
    );

    ngOnInit(): void {
        this.cargarUsuarios();
    }

    cargarUsuarios(): void {
        this.cargando.set(true);

        this.http.get<UsuarioApi[]>(this.apiUrl).subscribe({
            next: (respuesta) => {
                const usuarios = respuesta.map((usuario) =>
                    this.convertirUsuario(usuario)
                );

                this.usuarios.set(usuarios);
                this.cargando.set(false);
            },
            error: (error: HttpErrorResponse) => {
                this.mostrarError(
                    error,
                    'No fue posible cargar los usuarios.'
                );
                this.cargando.set(false);
            },
        });
    }

    buscar(event: Event): void {
        const input = event.target as HTMLInputElement;
        this.busqueda.set(input.value);
    }

    abrirFormulario(): void {
        this.usuarioEditandoId.set(null);
        this.formulario.set({ ...FORMULARIO_INICIAL });
        this.mensaje.set('');
        this.mostrarFormulario.set(true);
    }

    cerrarFormulario(): void {
        this.mostrarFormulario.set(false);
        this.usuarioEditandoId.set(null);
        this.formulario.set({ ...FORMULARIO_INICIAL });
        this.mensaje.set('');
    }

    actualizarTexto(
        campo: 'id_temp' | 'email' | 'password' | 'name',
        event: Event
    ): void {
        const input = event.target as HTMLInputElement;

        this.formulario.update((formulario) => ({
            ...formulario,
            [campo]: input.value,
        }));
    }

    actualizarRol(event: Event): void {
        const select = event.target as HTMLSelectElement;

        this.formulario.update((formulario) => ({
            ...formulario,
            role: select.value,
        }));
    }

    actualizarEstado(isActive: boolean): void {
        this.formulario.update((formulario) => ({
            ...formulario,
            is_active: isActive,
        }));
    }

    guardarUsuario(): void {
        const datos = this.formulario();
        const editandoId = this.usuarioEditandoId();

        if (!datos.name.trim() || !datos.email.trim()) {
            this.mensaje.set(
                'El nombre y el correo son obligatorios.'
            );
            return;
        }

        if (!this.correoValido(datos.email)) {
            this.mensaje.set(
                'Ingresa un correo electrónico válido.'
            );
            return;
        }

        if (!editandoId && !datos.password.trim()) {
            this.mensaje.set(
                'La contraseña es obligatoria para un usuario nuevo.'
            );
            return;
        }

        const cuerpo: Record<string, string | boolean | null> = {
            id_temp: datos.id_temp.trim() || null,
            email: datos.email.trim().toLowerCase(),
            name: datos.name.trim(),
            role: datos.role,
            is_active: datos.is_active,
        };

        if (datos.password.trim()) {
            cuerpo['password'] = datos.password;
        }

        this.cargando.set(true);

        if (editandoId) {
            this.http
                .patch<UsuarioApi>(
                    `${this.apiUrl}/${editandoId}`,
                    cuerpo
                )
                .subscribe({
                    next: (usuarioActualizado) => {
                        const usuario =
                            this.convertirUsuario(usuarioActualizado);

                        this.usuarios.update((usuarios) =>
                            usuarios.map((item) =>
                                item.id === usuario.id
                                    ? usuario
                                    : item
                            )
                        );

                        this.finalizarGuardado(
                            'Usuario actualizado correctamente.'
                        );
                    },
                    error: (error: HttpErrorResponse) => {
                        this.mostrarError(
                            error,
                            'No fue posible actualizar el usuario.'
                        );
                        this.cargando.set(false);
                    },
                });

            return;
        }

        this.http.post<UsuarioApi>(this.apiUrl, cuerpo).subscribe({
            next: (usuarioCreado) => {
                const usuario = this.convertirUsuario(usuarioCreado);

                this.usuarios.update((usuarios) => [
                    usuario,
                    ...usuarios,
                ]);

                this.finalizarGuardado(
                    'Usuario registrado correctamente.'
                );
            },
            error: (error: HttpErrorResponse) => {
                this.mostrarError(
                    error,
                    'No fue posible registrar el usuario.'
                );
                this.cargando.set(false);
            },
        });
    }

    editarUsuario(usuario: Usuario): void {
        this.usuarioEditandoId.set(usuario.id);

        this.formulario.set({
            id_temp: usuario.id_temp ?? '',
            email: usuario.email,
            password: '',
            name: usuario.name,
            role: usuario.role,
            is_active: usuario.is_active,
        });

        this.mensaje.set('');
        this.mostrarFormulario.set(true);

        window.scrollTo({
            top: 0,
            behavior: 'smooth',
        });
    }

    cambiarEstado(id: string): void {
        const usuario = this.usuarios().find(
            (item) => item.id === id
        );

        if (!usuario) {
            return;
        }

        const nuevoEstado = !usuario.is_active;

        this.http
            .patch<UsuarioApi>(`${this.apiUrl}/${id}/status`, {
                is_active: nuevoEstado,
            })
            .subscribe({
                next: (respuesta) => {
                    const usuarioActualizado =
                        this.convertirUsuario(respuesta);

                    this.usuarios.update((usuarios) =>
                        usuarios.map((item) =>
                            item.id === id
                                ? usuarioActualizado
                                : item
                        )
                    );
                },
                error: (error: HttpErrorResponse) => {
                    this.mostrarError(
                        error,
                        'No fue posible cambiar el estado.'
                    );
                },
            });
    }

    eliminarUsuario(id: string): void {
        const usuario = this.usuarios().find(
            (item) => item.id === id
        );

        if (!usuario) {
            return;
        }

        const confirmado = window.confirm(
            `¿Estás seguro de eliminar a ${usuario.name}?`
        );

        if (!confirmado) {
            return;
        }

        this.http.delete(`${this.apiUrl}/${id}`).subscribe({
            next: () => {
                this.usuarios.update((usuarios) =>
                    usuarios.filter((item) => item.id !== id)
                );

                this.mensaje.set(
                    'Usuario eliminado correctamente.'
                );
            },
            error: (error: HttpErrorResponse) => {
                this.mostrarError(
                    error,
                    'No fue posible eliminar el usuario.'
                );
            },
        });
    }

    trackById(index: number, usuario: Usuario): string {
        return usuario.id;
    }

    private convertirUsuario(usuario: UsuarioApi): Usuario {
        return {
            ...usuario,
            created_at: new Date(usuario.created_at),
        };
    }

    private finalizarGuardado(mensaje: string): void {
        this.mensaje.set(mensaje);
        this.cargando.set(false);
        this.usuarioEditandoId.set(null);
        this.formulario.set({ ...FORMULARIO_INICIAL });

        setTimeout(() => {
            this.mostrarFormulario.set(false);
            this.mensaje.set('');
        }, 1000);
    }

    private mostrarError(
        error: HttpErrorResponse,
        mensajePredeterminado: string
    ): void {
        const mensajeBackend = error.error?.message;

        this.mensaje.set(
            typeof mensajeBackend === 'string'
                ? mensajeBackend
                : mensajePredeterminado
        );
    }

    private correoValido(email: string): boolean {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
            email.trim()
        );
    }
}