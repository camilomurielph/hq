# Obsidian HQ — Dashboard & Backend

Panel de control web para gestionar tu vault de Obsidian (`myVault`) conectado directamente a GitHub (`git pull` / `git push` seguro) y listo para desplegar en **Coolify** con autenticación por contraseña.

## Variables de entorno (Coolify / `.env`)

| Variable | Descripción |
| :--- | :--- |
| `HQ_PASSWORD` | Contraseña de acceso al panel web (si está vacía, no pide login). |
| `HQ_SECRET_KEY` | Clave secreta para firmar las cookies de sesión. |
| `VAULT_REPO_URL` | URL HTTPS del repositorio del vault (`https://github.com/camilomurielph/myVault`). |
| `GITHUB_TOKEN` | Personal Access Token de GitHub con permisos de lectura/escritura en el repo. |
| `OBSIDIAN_VAULT_PATH` | Ruta al vault (`/app/vault` en Docker/Coolify). |
| `AUTO_GIT_SYNC` | `true` para sincronizar automáticamente con GitHub al editar notas o tareas. |

## Despliegue en Coolify

1. Sube la carpeta `hq-dashboard` a un repositorio de GitHub.
2. En **Coolify**, crea un nuevo recurso apuntando a ese repositorio usando **Dockerfile** (puerto expuesto: `4320`).
3. Añade las variables de entorno en Coolify (`HQ_PASSWORD`, `HQ_SECRET_KEY`, `VAULT_REPO_URL`, `GITHUB_TOKEN`, `OBSIDIAN_VAULT_PATH=/app/vault`, `AUTO_GIT_SYNC=true`).
4. (Opcional recomendado) Monta un volumen persistente en `/app/vault` y `/app/data`.
5. Despliega y accede desde tu PC o celular.
