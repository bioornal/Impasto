"use client";
import { createContext, useContext } from "react";

const Ctx = createContext<{ email: string }>({ email: "" });

/** El mail de quien inició sesión, para el pie del menú. Lo pone `app/admin/layout.tsx`. */
export function AdminSesion({ email, children }: { email: string; children: React.ReactNode }) {
  return <Ctx.Provider value={{ email }}>{children}</Ctx.Provider>;
}

export const useAdminSesion = () => useContext(Ctx);
