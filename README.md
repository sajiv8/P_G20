# P_G20
A Microservices-Based Multi-Tenant Resource Sharing and Optimization Platform for University Campus Communities

## CI/CD And ArgoCD Scaffold

This repo now includes a GitHub Actions to ArgoCD deployment scaffold for a DigitalOcean-hosted Kubernetes cluster behind nginx and Cloudflare.

### What is included

- A container image that serves the app through nginx.
- A GitHub Actions workflow that builds and pushes the image on changes to `main`.
- ArgoCD application and Kustomize manifests for automatic sync.
- A three-slot release history file so only the latest three builds are tracked for rollback.
- An nginx ingress manifest that expects a Cloudflare origin TLS secret.

### Repository layout

- `Dockerfile` and `nginx/default.conf` build the runtime image.
- `site/index.html` is the current placeholder web root.
- `.github/workflows/cicd.yml` builds and publishes the image.
- `k8s/base` contains the shared Kubernetes objects.
- `k8s/overlays/prod` contains the ArgoCD-managed production overlay.
- `argocd/application.yaml` points ArgoCD at the production overlay.

### Required setup

1. Create or install ArgoCD in your DigitalOcean Kubernetes cluster.
2. Apply `argocd/application.yaml` to register this repository with ArgoCD.
3. Replace `app.example.com` in `k8s/base/ingress.yaml` with your real Cloudflare-managed hostname.
4. Create the TLS secret from your Cloudflare origin certificate:

	`kubectl create secret tls p-g20-origin-tls --cert=origin.crt --key=origin.key -n p-g20`

5. Make sure Cloudflare SSL mode is set to `Full (strict)`.
6. If you keep the GHCR image private, create an image pull secret for the cluster and reference it from the deployment.

### How the pipeline works

1. Push a change to `main`.
2. GitHub Actions builds the Docker image and pushes it to GHCR.
3. The workflow updates `k8s/overlays/prod/deploy-history.json` and the rollout annotation in `k8s/overlays/prod/kustomization.yaml`.
4. ArgoCD sees the Git change and syncs the cluster.
5. The release history keeps only the latest three builds, which are also the supported rollback targets.

### Rollback

Use `scripts/rollback.ps1` to move the overlay back to build slot 1, 2, or 3. Slot 1 is the current build, slot 2 is the previous build, and slot 3 is the oldest retained build.

### Notes

- This scaffold is ready for infrastructure wiring, but the repo currently does not contain application source code.
- If your app is not a static site, replace the placeholder `site/` content and adjust the Dockerfile build stage to your real application.
