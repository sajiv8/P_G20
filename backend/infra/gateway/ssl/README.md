# TLS certificates

**Nothing in this directory is committed.** `origin.pem` and `origin-key.pem` are
gitignored and must be obtained separately.

## If you just pulled and your gateway will not start

The certificates used to be committed and were removed (defect D-01). Your
working copy no longer has them, so nginx fails at startup with:

```
cannot load certificate "/etc/nginx/ssl/origin.pem"
```

Get the current Cloudflare Origin Certificate from whoever administers the
Cloudflare account and save both files here:

```
backend/infra/gateway/ssl/origin.pem
backend/infra/gateway/ssl/origin-key.pem
```

Then `cd backend/infra && docker compose up -d --force-recreate gateway`.

> Docker bind-mounts a single file by inode, so replacing either file breaks the
> mount in a running container. Always recreate the gateway rather than
> restarting it.

## Production

Kubernetes does **not** use these files. The gateway pod mounts a Secret named
`ssl-origin-certs` (see `k8s/base/gateway.yaml`). Create or rotate it with:

```bash
kubectl create secret generic ssl-origin-certs \
  --from-file=origin.pem=./origin.pem \
  --from-file=origin-key.pem=./origin-key.pem \
  --namespace <your-namespace> \
  --dry-run=client -o yaml | kubectl apply -f -
```

---

## D-01 remediation status

Removing the files from tracking stops the leak getting worse. **It does not fix
it.** The private key is still in git history, so anyone who can read the
repository — or any existing clone, fork, or CI cache — can still recover it.

Two steps remain, and both need a human decision:

### 1. Rotate the certificate — do this first

Until the key is replaced, the old one is compromised regardless of what git
says.

1. In the Cloudflare dashboard, go to **SSL/TLS → Origin Server**.
2. **Revoke** the existing Origin Certificate.
3. Create a new one, and save the new key and certificate here (never in git).
4. Update the Kubernetes secret with the command above.
5. Recreate the gateway locally and roll the pods in production.

### 2. Purge it from git history

Only worth doing after rotation, and it rewrites history, so the whole team has
to coordinate:

```bash
# Using git-filter-repo (recommended over filter-branch)
git filter-repo --invert-paths \
  --path backend/infra/gateway/ssl/origin-key.pem \
  --path backend/infra/gateway/ssl/origin.pem
```

This rewrites every commit, which means:

- **Every commit hash changes.** Open pull requests will need rebasing.
- **Everyone must re-clone.** A normal `git pull` will conflict badly.
- It requires a force-push to a shared branch, which is destructive — agree it
  with the team before running it.
- Forks, existing clones and CI caches keep the old history regardless. This is
  precisely why rotation matters more than the purge.

If the repository is private and the team is small, rotating the certificate and
leaving history alone is a defensible decision. Rotating is not optional.

### 3. Stop it happening again

`gitleaks` already runs in CI (`.github/workflows/ci.yml`) but is set to
`continue-on-error: true` so it reports without blocking, because it fails on
this very key. Once history is clean, remove that flag to make committed secrets
a hard build failure.
