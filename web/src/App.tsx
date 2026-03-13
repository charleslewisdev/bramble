import { Routes, Route, Link } from "react-router-dom";
import Layout from "./components/layout/Layout";
import Dashboard from "./pages/Dashboard";
import LocationList from "./pages/LocationList";
import LocationDetail from "./pages/LocationDetail";
import ZoneDetail from "./pages/ZoneDetail";
import PlantBrowser from "./pages/PlantBrowser";
import PlantDetail from "./pages/PlantDetail";
import MyPlants from "./pages/MyPlants";
import MyPlantDetail from "./pages/MyPlantDetail";
import CareTasks from "./pages/CareTasks";
import ShoppingList from "./pages/ShoppingList";
import Shed from "./pages/Shed";
import Settings from "./pages/Settings";
import Almanac from "./pages/Almanac";
import CompostingGuide from "./pages/almanac/CompostingGuide";
import PlantSprite from "./components/sprites/PlantSprite";
import { lazy, Suspense } from "react";

const GardenMap = lazy(() => import("./pages/GardenMap"));

function NotFound() {
  return (
    <div className="text-center py-20">
      <PlantSprite type="flower" mood="sleeping" size={96} className="mx-auto" />
      <h1 className="text-3xl font-bold font-display text-stone-100 mt-6">
        404 - Page Not Found
      </h1>
      <p className="text-stone-400 mt-2 font-display">
        This page has gone dormant. It might not exist, or it wandered off.
      </p>
      <Link
        to="/"
        className="inline-block mt-6 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-semibold font-display text-white transition-colors"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/locations" element={<LocationList />} />
        <Route path="/locations/:id" element={<LocationDetail />} />
        <Route path="/locations/:id/map" element={<Suspense fallback={<div className="fixed inset-0 bg-stone-950 flex items-center justify-center"><p className="text-stone-400">Loading garden map...</p></div>}><GardenMap /></Suspense>} />
        <Route path="/zones/:id" element={<ZoneDetail />} />
        <Route path="/plants" element={<PlantBrowser />} />
        <Route path="/plants/:id" element={<PlantDetail />} />
        <Route path="/my-plants" element={<MyPlants />} />
        <Route path="/my-plants/:id" element={<MyPlantDetail />} />
        <Route path="/care" element={<CareTasks />} />
        <Route path="/shopping" element={<ShoppingList />} />
        <Route path="/locations/:id/shed" element={<Shed />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/almanac" element={<Almanac />} />
        <Route path="/almanac/composting" element={<CompostingGuide />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}
