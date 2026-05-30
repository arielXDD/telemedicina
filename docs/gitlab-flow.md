# GitLab Flow

## Ramas

- `feature/*`: cambios de desarrollo aislados. Ejemplo: `feature/fix-server-connections`.
- `main`: integracion estable despues de merge request y pruebas automatizadas.
- `staging`: despliegue a pruebas. Solo recibe merges desde `main`.
- `production`: despliegue productivo. Solo recibe merges desde `staging`.

## Reglas

- No se trabaja directo sobre `main`, `staging` o `production`.
- Cada cambio significativo debe cerrar con commit atomico y mensaje convencional: `fix:`, `feat:`, `test:`, `docs:` o `chore:`.
- Todo merge a `main` debe ejecutar build, unit tests e integration tests.
- Todo merge a `staging` debe desplegar contenedores contra variables de staging.
- Todo merge a `production` debe salir desde `staging` ya validado.

## Flujo Recomendado

```bash
git switch main
git pull
git switch -c feature/nombre-del-cambio
git add .
git commit -m "fix: descripcion concreta"
git push -u origin feature/nombre-del-cambio
```

Despues del merge request:

```bash
git switch main
git pull
git switch staging
git merge --ff-only main
git push origin staging
```

Para produccion:

```bash
git switch production
git merge --ff-only staging
git push origin production
```
