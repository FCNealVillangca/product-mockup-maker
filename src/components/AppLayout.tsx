import { NavLink, Outlet } from "react-router-dom";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
    isActive
      ? "bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-100"
      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100",
  ].join(" ");

export function AppLayout() {
  return (
    <>
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur dark:border-gray-800 dark:bg-gray-900/80">
        <nav className="mx-auto flex max-w-5xl items-center gap-2 px-7 py-3">
          <NavLink to="/" end className={linkClass}>
            Mockup generator
          </NavLink>
          <NavLink to="/product-visualizer" className={linkClass}>
            Product visualizer
          </NavLink>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}
