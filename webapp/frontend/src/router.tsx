// src/router.tsx
import { createBrowserRouter, redirect } from 'react-router-dom';
import App from './pages/App';
import Login from './pages/Login';
import Settings from './pages/Settings';
import { AuthApi } from './api/authApi';


async function requireAuthed() {
  const s = await AuthApi.getAuthStatus();
  if (s.mode === "open") return null;
  if (s.authed) return null;
  throw redirect("/login");
}

async function loginLoader() {
  const s = await AuthApi.getAuthStatus();
  // If already authed (or open mode), don't show login
  if (s.mode === "open") throw redirect("/");
  if (s.authed) throw redirect("/");
  return null;
}

export const router = createBrowserRouter([
  { path: "/login", element: <Login />, loader: loginLoader },
  { path: "/", element: <App />, loader: requireAuthed },
  { path: "/settings", element: <Settings />, loader: requireAuthed },
]);