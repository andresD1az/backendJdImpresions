# Frontend setup (React + Vite + Tailwind)

Commands to scaffold:

```powershell
# from repo root
npm create vite@latest frontend -- --template react
npm install --prefix frontend
npm install -D tailwindcss postcss autoprefixer --prefix frontend
npx tailwindcss init -p --cwd frontend
```

Then configure Tailwind:
- tailwind.config.js: set `content` to ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"]
- src/index.css: add `@tailwind base; @tailwind components; @tailwind utilities;`

Run dev server:
```powershell
npm run dev --prefix frontend
```
