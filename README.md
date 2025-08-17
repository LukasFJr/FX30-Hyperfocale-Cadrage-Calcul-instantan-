# FX30 Hyperfocale Cadrage Calcul instantan-

Pré-requis: Node 18+ / npm 8+.

Installation :

```bash
npm install
```

Lancer en local :

```bash
npm run dev
```

Build pour GitHub Pages (génère /docs) :

```bash
npm run build
```

Déploiement :

```bash
git add .
git commit -m "Build for GitHub Pages"
git push
```

Réglage GitHub Pages : Settings → Pages → Deploy from a branch → main + /docs.

Note : remplace /<REPO_NAME>/ dans vite.config.js par le nom exact du repo.

Mise à jour : refaire npm run build, commit, push.

Astuce 404: le base doit absolument être /<REPO_NAME>/.
