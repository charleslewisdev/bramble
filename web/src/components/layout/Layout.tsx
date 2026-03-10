import { type ReactNode } from "react";
import Sidebar from "./Sidebar";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-stone-950">
      <Sidebar />
      <main className="md:ml-64 min-h-screen">
        <div className="max-w-6xl mx-auto p-6 pt-16 md:pt-6">{children}</div>
      </main>
    </div>
  );
}
