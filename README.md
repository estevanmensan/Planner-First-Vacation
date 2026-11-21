# Planner Dezembro 2026

Calendário de dezembro com um álbum de fotos para cada dia. O site fica no GitHub Pages, e as fotos ficam no Supabase, protegidas por login.

## 1. Supabase (onde ficam as fotos)

1. Crie uma conta em https://supabase.com e um **New project**.
2. Abra **SQL Editor > New query**, cole o conteúdo de `supabase-setup.sql` e clique em **Run**.
3. Para que só vocês possam entrar:
   - **Authentication > Sign In / Providers**: desative **Allow new users to sign up**.
   - **Authentication > Users > Add user > Create new user**: crie um usuário com e-mail e senha para cada pessoa que vai usar o site. Marque **Auto Confirm User**.
4. **Authentication > URL Configuration**: em **Site URL**, coloque o endereço do seu GitHub Pages (por exemplo `https://seu-usuario.github.io/planner/`).
5. Em **Project Settings > API** (ou **API Keys**), copie a **Project URL** e a chave pública (**anon** ou **publishable**).

## 2. Configurar o site

Abra `config.js` e cole a URL e a chave pública.
A chave pública pode ficar visível no site. Quem protege as fotos é o login e as regras do script SQL.
**Nunca** use a chave `service_role` / `secret`.

## 3. GitHub Pages

1. No GitHub, crie um repositório (por exemplo `planner`).
2. **Add file > Upload files**: envie `index.html`, `style.css`, `app.js` e `config.js`, depois clique em **Commit changes**.
3. **Settings > Pages**: em *Source*, escolha **Deploy from a branch**, depois a branch **main** e a pasta **/ (root)**, e salve.
4. Depois de cerca de 1 minuto, o site fica disponível em `https://seu-usuario.github.io/planner/`.

## Testar no computador antes de publicar

Na pasta do projeto, rode `python -m http.server 8000` e abra http://localhost:8000.
Abrir o `index.html` com dois cliques também costuma funcionar, mas o servidor local evita problemas.
