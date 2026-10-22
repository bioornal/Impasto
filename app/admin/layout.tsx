import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { AdminSesion } from "./components/AdminSesion";
import "./admin.css";

export const metadata: Metadata = {
  title: "Impasto Admin · Panel",
  // El panel nunca se indexa, aunque alguien enlace la URL desde afuera.
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin-login");
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;650;700&display=swap"
        rel="stylesheet"
      />
      <AdminSesion email={String(admin.email || "")}>{children}</AdminSesion>
    </>
  );
}
