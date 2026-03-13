import { NavLink } from "react-router-dom";
import {
  Home,
  MapPin,
  Flower2,
  Sprout,
  CalendarCheck,
  ShoppingCart,
  BookOpen,
  Settings,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import clsx from "clsx";
import PlantSprite from "../sprites/PlantSprite";
import { usePlantInstances } from "../../api/hooks";
import type { PlantType, PlantMood } from "../../api";

const navItems = [
  { to: "/", icon: Home, label: "Dashboard" },
  { to: "/locations", icon: MapPin, label: "Locations" },
  { to: "/plants", icon: Flower2, label: "Plants" },
  { to: "/my-plants", icon: Sprout, label: "My Plants" },
  { to: "/care", icon: CalendarCheck, label: "Care Tasks" },
  { to: "/shopping", icon: ShoppingCart, label: "Shopping" },
  { to: "/almanac", icon: BookOpen, label: "Almanac" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

// Fallback mood garden plants when no API data
const defaultMoodPlants: Array<{ type: PlantType; mood: PlantMood }> = [
  { type: "flower", mood: "happy" },
  { type: "cactus", mood: "happy" },
  { type: "fern", mood: "thirsty" },
  { type: "succulent", mood: "sleeping" },
];

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: plants } = usePlantInstances();

  // Build mood garden from actual user plants (up to 5)
  const moodGardenPlants: Array<{ type: PlantType; mood: PlantMood }> =
    plants && plants.length > 0
      ? plants.slice(0, 5).map((p) => ({
          type: (p.plantReference?.plantType as PlantType) ?? "flower",
          mood: p.mood,
        }))
      : defaultMoodPlants;

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-stone-900 border border-stone-800 text-stone-300 md:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          "fixed top-0 left-0 z-40 h-screen w-64 bg-stone-950 border-r border-stone-800 flex flex-col transition-transform duration-200 md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <header className="p-5 border-b border-stone-800">
          <div className="flex items-center gap-3">
            {/* Pixel leaf icon */}
            <svg
              width={32}
              height={32}
              viewBox="0 0 32 32"
              style={{ imageRendering: "pixelated" }}
            >
              <rect x={14} y={4} width={4} height={4} fill="#22c55e" />
              <rect x={10} y={8} width={4} height={4} fill="#16a34a" />
              <rect x={14} y={8} width={4} height={4} fill="#22c55e" />
              <rect x={18} y={8} width={4} height={4} fill="#16a34a" />
              <rect x={6} y={12} width={4} height={4} fill="#22c55e" />
              <rect x={10} y={12} width={4} height={4} fill="#15803d" />
              <rect x={14} y={12} width={4} height={4} fill="#16a34a" />
              <rect x={18} y={12} width={4} height={4} fill="#22c55e" />
              <rect x={10} y={16} width={4} height={4} fill="#16a34a" />
              <rect x={14} y={16} width={4} height={4} fill="#15803d" />
              <rect x={14} y={20} width={4} height={4} fill="#92400e" />
              <rect x={14} y={24} width={4} height={4} fill="#78350f" />
            </svg>
            <span className="text-xl font-bold font-display text-stone-100">
              Bramble
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1 font-mono">
            your garden, your way
          </p>
        </header>

        {/* Navigation */}
        <nav aria-label="Main navigation" className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium font-display transition-colors",
                  isActive
                    ? "bg-emerald-600/20 text-emerald-400 border-l-2 border-emerald-400"
                    : "text-stone-400 hover:text-stone-200 hover:bg-stone-900 border-l-2 border-transparent"
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Mood garden widget */}
        <div className="p-4 border-t border-stone-800">
          <p className="text-xs text-stone-500 font-mono mb-2">
            garden mood
          </p>
          <div className="flex items-end gap-1 justify-center">
            {moodGardenPlants.map((p, i) => (
              <PlantSprite key={i} type={p.type} mood={p.mood} size={28} />
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}
