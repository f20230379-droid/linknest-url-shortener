# Deploy LinkNest publicly

This app uses Supabase for production data and Render to host the Node.js server. The server-only Supabase key is never placed in browser code or committed to Git.

## 1. Create the database

1. Create a free project at [Supabase](https://supabase.com/dashboard).
2. Wait for it to finish starting, then open **SQL Editor** > **New query**.
3. Copy every line from `supabase/schema.sql`, paste it, and choose **Run**.
4. Open **Project Settings** > **API Keys**. Copy the **Project URL** and the server-only **Secret** key. Never share that key or add it to GitHub. If your dashboard only shows legacy keys, use the `service_role` key instead.

## 2. Put the project on GitHub

Create a new empty GitHub repository named `linknest-url-shortener`. In a terminal inside this folder, run:

```powershell
git add .
git commit -m "Prepare LinkNest for deployment"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/linknest-url-shortener.git
git push -u origin main
```

GitHub will open a sign-in prompt if this is your first push from this computer.

## 3. Deploy the server

1. Sign in at [Render](https://dashboard.render.com/) with GitHub.
2. Select **New** > **Blueprint**, then select the `linknest-url-shortener` repository. Render reads `render.yaml` for the correct commands.
3. Add these two secret environment variables when prompted:
   - `SUPABASE_URL`: your Supabase Project URL
   - `SUPABASE_SECRET_KEY`: your server-only Secret key (or use `SUPABASE_SERVICE_ROLE_KEY` with a legacy service-role key)
4. Create the service and wait for the deploy to complete.
5. Open the generated `https://…onrender.com` address. That is the public URL you can share.

## Verify

Create a link, open the new short URL in another browser tab, then refresh the dashboard. Its click count should increase.

## Important

- `localhost` is for your computer only. The Render URL is public.
- Do not commit `.env` files or your service-role key.
- The free tier of any cloud platform can have changing limits. Review the provider's current plan details before using this as a production service.
