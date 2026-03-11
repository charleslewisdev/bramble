import { useNavigate } from "react-router-dom";
import {
  MapPin,
  Sprout,
  CalendarCheck,
  CloudSun,
  ArrowRight,
  Plus,
  Sun,
  Sunrise,
  Sunset,
  Clock,
  Bug,
  Bird,
  Flower2,
  AlertTriangle,
} from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import PlantSprite, {
  getMoodMessage,
} from "../components/sprites/PlantSprite";
import StatusBadge from "../components/ui/StatusBadge";
import {
  usePlantInstances,
  useCareTasks,
  useLocations,
  useWeather,
  useSunData,
  useSunPosition,
  useWildlife,
  useAlerts,
  useSettings,
} from "../api/hooks";
import type { PlantMood, PlantType, Location, Weather, WeatherAlert } from "../api";
import { getSeasonalSummary, getCurrentSeason } from "../utils/mood";
import { getWeatherEmoji, formatTemperature, formatTempShort } from "../utils/weather";
import { formatDate } from "../utils/format";

function WeatherCard({ location, tempUnit }: { location: Location; tempUnit: string }) {
  const { data: weather } = useWeather(location.id);

  return (
    <Card className="min-w-0">
      <div className="flex items-center gap-2 mb-2">
        <MapPin size={12} className="text-stone-500 shrink-0" />
        <p className="text-xs text-stone-400 font-display truncate">
          {location.name}
        </p>
      </div>
      {weather?.temperature != null ? (
        <div className="flex items-center gap-3">
          <div className="text-center">
            <p className="text-2xl">{getWeatherEmoji(weather.conditions)}</p>
            <p className="text-lg font-bold font-mono text-stone-100">
              {formatTemperature(weather.temperature, tempUnit)}
            </p>
          </div>
          <div className="flex-1 min-w-0 text-xs space-y-0.5">
            <p className="text-stone-400 truncate">{weather.conditions ?? "--"}</p>
            <p className="text-stone-500 font-mono">
              H:{weather.temperatureHigh != null ? formatTempShort(weather.temperatureHigh, tempUnit) : "--"}
              {" "}L:{weather.temperatureLow != null ? formatTempShort(weather.temperatureLow, tempUnit) : "--"}
            </p>
            <p className="text-stone-500 font-mono">
              {weather.humidity != null ? `${Math.round(weather.humidity)}% hum` : ""}
              {weather.windSpeed != null ? ` \u{00b7} ${Math.round(weather.windSpeed)}mph` : ""}
            </p>
            {(weather.uvIndex != null || weather.precipitationProbability != null) && (
              <p className="text-stone-500 font-mono">
                {weather.uvIndex != null ? `UV ${weather.uvIndex}` : ""}
                {weather.precipitationProbability != null ? ` \u{00b7} ${Math.round(weather.precipitationProbability)}% rain` : ""}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-2">
          <CloudSun className="mx-auto text-stone-600 mb-1" size={20} />
          <p className="text-xs text-stone-500">No data</p>
        </div>
      )}
    </Card>
  );
}

function SunWidget({ locationId, locationName }: { locationId: number; locationName?: string }) {
  const { data: sunData } = useSunData(locationId);
  const { data: sunPosition } = useSunPosition(locationId);

  if (!sunData) return null;

  const now = new Date();
  const sunrise = new Date(sunData.sunrise);
  const sunset = new Date(sunData.sunset);
  const total = sunset.getTime() - sunrise.getTime();
  const elapsed = now.getTime() - sunrise.getTime();
  const progress = Math.max(0, Math.min(1, elapsed / total));
  const isDaytime = progress > 0 && progress < 1;

  const hours = Math.floor(sunData.dayLengthMinutes / 60);
  const minutes = sunData.dayLengthMinutes % 60;

  return (
    <Card>
      <h3 className="text-sm font-semibold font-display text-stone-300 uppercase tracking-wider mb-3">
        Sun &amp; Daylight{locationName ? ` \u{2014} ${locationName}` : ""}
      </h3>

      {/* Mini sun arc */}
      <div className="flex justify-center mb-3">
        <svg width={200} height={50} viewBox="0 0 200 50">
          {/* Arc */}
          <path
            d="M 10 45 Q 100 -20 190 45"
            fill="none"
            stroke="rgba(250, 204, 21, 0.2)"
            strokeWidth={2}
            strokeDasharray="4 3"
          />
          {/* Horizon line */}
          <line x1={5} y1={45} x2={195} y2={45} stroke="rgba(120,113,108,0.3)" strokeWidth={1} />
          {/* Current sun position */}
          {isDaytime && (() => {
            const t = progress;
            const sunX = 10 + t * 180;
            const sunY = (1-t)*(1-t)*45 + 2*(1-t)*t*(-20) + t*t*45;
            return (
              <circle cx={sunX} cy={sunY} r={6} fill="#facc15" opacity={0.9}>
                <animate attributeName="opacity" values="0.7;1;0.7" dur="3s" repeatCount="indefinite" />
              </circle>
            );
          })()}
          {/* Labels */}
          <text x={10} y={12} fontSize={8} fill="#78716c" fontFamily="monospace">
            {sunrise.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </text>
          <text x={140} y={12} fontSize={8} fill="#78716c" fontFamily="monospace" textAnchor="end">
            {sunset.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </text>
        </svg>
      </div>

      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="text-center">
          <Sunrise size={14} className="mx-auto text-amber-400 mb-1" />
          <p className="text-stone-300 font-mono">
            {sunrise.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </p>
          <p className="text-stone-500">Sunrise</p>
        </div>
        <div className="text-center">
          <Clock size={14} className="mx-auto text-yellow-400 mb-1" />
          <p className="text-stone-300 font-mono">
            {hours}h {minutes}m
          </p>
          <p className="text-stone-500">Daylight</p>
        </div>
        <div className="text-center">
          <Sunset size={14} className="mx-auto text-orange-400 mb-1" />
          <p className="text-stone-300 font-mono">
            {sunset.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </p>
          <p className="text-stone-500">Sunset</p>
        </div>
      </div>

      {sunData.goldenHour && (
        <div className="mt-2 pt-2 border-t border-stone-800 text-center">
          <p className="text-xs text-amber-400/80 font-mono">
            Golden hour: {new Date(sunData.goldenHour.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </p>
        </div>
      )}
    </Card>
  );
}

function WildlifeWidget({ locationId, locationName }: { locationId: number; locationName?: string }) {
  const { data: wildlife } = useWildlife(locationId);

  if (!wildlife || wildlife.wildlife.length === 0) return null;

  const currentMonth = new Date().getMonth() + 1; // 1-indexed
  const activeNow = wildlife.wildlife.filter((w: { activeMonths?: number[] }) => w.activeMonths?.includes(currentMonth));

  if (activeNow.length === 0) return null;

  const categoryIcons: Record<string, typeof Bug> = {
    pollinator: Flower2,
    bird: Bird,
    beneficial_insect: Bug,
    reptile: Bug,
    mammal: Bug,
    amphibian: Bug,
  };

  const categoryLabels: Record<string, string> = {
    pollinator: "Pollinators",
    bird: "Birds",
    beneficial_insect: "Beneficial Insects",
    mammal: "Mammals",
    reptile: "Reptiles",
    amphibian: "Amphibians",
  };

  // Group by category
  type WEntry = (typeof activeNow)[number];
  const byCategory = activeNow.reduce<Record<string, WEntry[]>>((acc, w) => {
    const cat = w.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat]!.push(w);
    return acc;
  }, {});

  return (
    <Card>
      <h3 className="text-sm font-semibold font-display text-stone-300 uppercase tracking-wider mb-3">
        Garden Visitors{locationName ? ` \u{2014} ${locationName}` : ""}
      </h3>
      <div className="space-y-3">
        {Object.entries(byCategory).map(([category, creatures]) => {
          const Icon = categoryIcons[category] ?? Bug;
          return (
            <div key={category}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon size={12} className="text-emerald-400" />
                <p className="text-xs font-semibold text-stone-400 font-display">
                  {categoryLabels[category] ?? category}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(creatures as WEntry[]).map((c) => (
                  <span
                    key={c.name}
                    className="text-xs px-2 py-1 rounded-lg bg-stone-800 text-stone-300 hover:bg-stone-700 cursor-default transition-colors"
                    title={c.funFact ?? c.description}
                  >
                    {c.name}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: plants, isLoading: plantsLoading } = usePlantInstances();
  const { data: tasks, isLoading: tasksLoading } = useCareTasks({
    upcoming: true,
  });
  const { data: locations } = useLocations();
  const { data: settings } = useSettings();
  const tempUnit = (settings?.temperatureUnit as string) ?? "F";

  const firstLocation = locations?.[0];
  const { data: alertsData } = useAlerts(firstLocation?.id);

  const needsAttention =
    plants?.filter(
      (p) =>
        p.mood === "thirsty" ||
        p.mood === "wilting" ||
        p.mood === "cold" ||
        p.mood === "hot"
    ) ?? [];

  const totalPlants = plants?.length ?? 0;
  const totalLocations = locations?.length ?? 0;
  const upcomingTasks = tasks ?? [];
  const todayStr = new Date().toISOString().slice(0, 10);
  const tasksDueToday = upcomingTasks.filter((t) => t.dueDate === todayStr);

  // Group tasks: overdue, today, this week
  const overdueTasks = upcomingTasks.filter((t) => t.dueDate && t.dueDate < todayStr);
  const thisWeekEnd = new Date();
  thisWeekEnd.setDate(thisWeekEnd.getDate() + 7);
  const thisWeekStr = thisWeekEnd.toISOString().slice(0, 10);
  const thisWeekTasks = upcomingTasks.filter(
    (t) => t.dueDate && t.dueDate > todayStr && t.dueDate <= thisWeekStr
  );

  function getWelcomeMessage(): string {
    if (totalPlants === 0 && totalLocations === 0) return "Welcome to Bramble! Let's start your garden.";
    if (needsAttention.length > 0)
      return `${needsAttention.length} plant${needsAttention.length > 1 ? "s" : ""} need${needsAttention.length === 1 ? "s" : ""} your attention!`;
    return "Your garden is looking great today!";
  }

  const showOnboarding = totalLocations === 0;
  const season = getCurrentSeason();
  const seasonLabel = season.charAt(0).toUpperCase() + season.slice(1);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold font-display text-stone-100">
          {getWelcomeMessage()}
        </h1>
        <p className="text-stone-400 mt-1 font-display">
          Here's what's happening in your garden
        </p>
      </div>

      {showOnboarding ? (
        <Card className="text-center py-12">
          <PlantSprite type="flower" mood="new" size={80} className="mx-auto" />
          <h2 className="text-xl font-semibold font-display text-stone-200 mt-6">
            Let's get growing!
          </h2>
          <p className="text-stone-400 mt-2 max-w-md mx-auto">
            Bramble helps you manage your garden, track your plants, and stay on top of care tasks. Here's how to get started:
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-emerald-600/20 flex items-center justify-center text-emerald-400 font-bold font-mono">1</div>
              <p className="text-sm text-stone-300 font-display">Add a location</p>
              <Button size="sm" onClick={() => navigate("/locations")}>
                <MapPin size={14} /> Add Location
              </Button>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-sky-600/20 flex items-center justify-center text-sky-400 font-bold font-mono">2</div>
              <p className="text-sm text-stone-300 font-display">Create zones</p>
              <p className="text-xs text-stone-500">(beds, yards, containers)</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-amber-600/20 flex items-center justify-center text-amber-400 font-bold font-mono">3</div>
              <p className="text-sm text-stone-300 font-display">Add plants</p>
              <Button size="sm" variant="secondary" onClick={() => navigate("/plants")}>
                <Sprout size={14} /> Browse Plants
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {/* Weather Alerts */}
          {alertsData && alertsData.alerts.length > 0 && (
            <div className="space-y-2">
              {alertsData.alerts.map((alert: WeatherAlert, idx: number) => {
                const borderColor =
                  alert.severity === "critical"
                    ? "border-l-red-500"
                    : alert.severity === "warning"
                      ? "border-l-amber-500"
                      : "border-l-sky-500";
                const iconColor =
                  alert.severity === "critical"
                    ? "text-red-400"
                    : alert.severity === "warning"
                      ? "text-amber-400"
                      : "text-sky-400";
                const bgColor =
                  alert.severity === "critical"
                    ? "bg-red-500/10"
                    : alert.severity === "warning"
                      ? "bg-amber-500/10"
                      : "bg-sky-500/10";

                return (
                  <Card key={`${alert.type}-${idx}`} className={`border-l-4 ${borderColor}`}>
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${bgColor} shrink-0`}>
                        <AlertTriangle size={16} className={iconColor} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold font-display ${iconColor}`}>
                          {alert.title}
                        </p>
                        <p className="text-xs text-stone-400 mt-0.5">
                          {alert.message}
                        </p>
                        {alert.affectedPlants.length > 0 && (
                          <p className="text-xs text-stone-500 mt-1 font-mono">
                            {alert.affectedPlants.length} plant{alert.affectedPlants.length > 1 ? "s" : ""} affected
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Seasonal Summary */}
          <Card className="border-l-4 border-l-emerald-500">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Sprout size={20} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold font-display text-stone-200">
                  {seasonLabel} {new Date().getFullYear()}
                </p>
                <p className="text-xs text-stone-400 mt-0.5">
                  {getSeasonalSummary(undefined, firstLocation?.hardinessZone)}
                </p>
              </div>
            </div>
          </Card>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card
              className="text-center"
              hoverable
              onClick={() => navigate("/my-plants")}
            >
              <Sprout className="mx-auto text-emerald-400 mb-2" size={24} />
              <p className="text-2xl font-bold font-mono text-stone-100">
                {totalPlants}
              </p>
              <p className="text-xs text-stone-400 font-display">
                Plants
              </p>
            </Card>

            <Card
              className="text-center"
              hoverable
              onClick={() => navigate("/locations")}
            >
              <MapPin className="mx-auto text-sky-400 mb-2" size={24} />
              <p className="text-2xl font-bold font-mono text-stone-100">
                {totalLocations}
              </p>
              <p className="text-xs text-stone-400 font-display">
                Locations
              </p>
            </Card>

            <Card
              className="text-center"
              hoverable
              onClick={() => navigate("/care")}
            >
              <CalendarCheck className="mx-auto text-amber-400 mb-2" size={24} />
              <p className="text-2xl font-bold font-mono text-stone-100">
                {tasksDueToday.length}
              </p>
              <p className="text-xs text-stone-400 font-display">
                Tasks Today
              </p>
            </Card>

            <Card className="text-center" hoverable onClick={() => navigate("/care")}>
              {overdueTasks.length > 0 ? (
                <>
                  <AlertTriangle className="mx-auto text-red-400 mb-2" size={24} />
                  <p className="text-2xl font-bold font-mono text-red-400">
                    {overdueTasks.length}
                  </p>
                  <p className="text-xs text-red-400/80 font-display">
                    Overdue
                  </p>
                </>
              ) : (
                <>
                  <CalendarCheck className="mx-auto text-emerald-400 mb-2" size={24} />
                  <p className="text-2xl font-bold font-mono text-stone-100">
                    0
                  </p>
                  <p className="text-xs text-stone-400 font-display">
                    Overdue
                  </p>
                </>
              )}
            </Card>
          </div>

          {/* Multi-location weather */}
          {locations && locations.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold font-display text-stone-200">
                Weather
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {locations.map((loc) => (
                  <WeatherCard key={loc.id} location={loc} tempUnit={tempUnit} />
                ))}
              </div>
            </div>
          )}

          {/* Sun & Wildlife widgets per location */}
          {locations && locations.length > 0 && (
            <div className="space-y-4">
              {locations.map((loc) => (
                <div key={loc.id} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SunWidget locationId={loc.id} locationName={locations.length > 1 ? loc.name : undefined} />
                  <WildlifeWidget locationId={loc.id} locationName={locations.length > 1 ? loc.name : undefined} />
                </div>
              ))}
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex gap-3">
            <Button size="sm" onClick={() => navigate("/plants")}>
              <Plus size={14} /> Add Plant
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate("/care")}>
              <Plus size={14} /> Add Task
            </Button>
          </div>

          {/* Plants needing attention */}
          {needsAttention.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold font-display text-stone-200 mb-3">
                Needs Attention
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {needsAttention.map((plant) => (
                  <Card
                    key={plant.id}
                    hoverable
                    onClick={() => navigate(`/my-plants/${plant.id}`)}
                    className="text-center py-4"
                  >
                    <PlantSprite
                      type={
                        (plant.plantReference?.plantType as PlantType) ?? "flower"
                      }
                      mood={plant.mood}
                      size={48}
                    />
                    <p className="text-sm font-medium text-stone-200 mt-2 font-display truncate">
                      {plant.nickname ?? plant.plantReference?.commonName ?? "Plant"}
                    </p>
                    <p className="text-xs text-stone-400 mt-1 font-mono italic">
                      {getMoodMessage(plant.mood, plant.nickname ?? undefined)}
                    </p>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Plant mood overview */}
          {plantsLoading ? (
            <Card>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-stone-800 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-stone-800 rounded animate-pulse" />
                  <div className="h-3 w-48 bg-stone-800 rounded animate-pulse" />
                </div>
              </div>
            </Card>
          ) : plants && plants.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold font-display text-stone-200">
                  Your Garden
                </h2>
                <button
                  onClick={() => navigate("/my-plants")}
                  className="text-sm text-emerald-400 hover:text-emerald-300 font-display flex items-center gap-1"
                >
                  View all <ArrowRight size={14} />
                </button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                {plants.slice(0, 16).map((plant) => (
                  <Card
                    key={plant.id}
                    hoverable
                    onClick={() => navigate(`/my-plants/${plant.id}`)}
                    className="text-center py-3 px-2"
                  >
                    <PlantSprite
                      type={
                        (plant.plantReference?.plantType as PlantType) ?? "flower"
                      }
                      mood={plant.mood}
                      size={40}
                    />
                    <p className="text-xs text-stone-300 mt-1 truncate font-display">
                      {plant.nickname ??
                        plant.plantReference?.commonName ??
                        "Plant"}
                    </p>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <Card className="text-center py-12">
              <PlantSprite type="flower" mood="new" size={64} className="mx-auto" />
              <p className="text-lg font-semibold font-display text-stone-200 mt-4">
                No plants yet? Let's fix that!
              </p>
              <p className="text-stone-400 text-sm mt-1">
                Start by browsing the plant database and adding some to your zones.
              </p>
              <button
                onClick={() => navigate("/plants")}
                className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-semibold font-display text-white transition-colors"
              >
                Browse Plants
              </button>
            </Card>
          )}

          {/* Today's Tasks - grouped by urgency */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold font-display text-stone-200">
                Tasks
              </h2>
              {upcomingTasks.length > 0 && (
                <button
                  onClick={() => navigate("/care")}
                  className="text-sm text-emerald-400 hover:text-emerald-300 font-display flex items-center gap-1"
                >
                  View all <ArrowRight size={14} />
                </button>
              )}
            </div>
            {tasksLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-stone-800 animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-40 bg-stone-800 rounded animate-pulse" />
                        <div className="h-3 w-24 bg-stone-800 rounded animate-pulse" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (overdueTasks.length > 0 || tasksDueToday.length > 0 || thisWeekTasks.length > 0) ? (
              <div className="space-y-4">
                {/* Overdue */}
                {overdueTasks.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-red-400 font-mono mb-1.5 uppercase flex items-center gap-1">
                      <AlertTriangle size={10} /> Overdue ({overdueTasks.length})
                    </p>
                    <div className="space-y-2">
                      {overdueTasks.map((task) => (
                        <Card key={task.id} hoverable onClick={() => navigate("/care")}
                          className="border-l-2 border-l-red-500/50"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {task.plantInstance && (
                                <PlantSprite
                                  type={(task.plantInstance.plantReference?.plantType as PlantType) ?? "flower"}
                                  mood={task.plantInstance.mood}
                                  size={28}
                                />
                              )}
                              <div>
                                <p className="text-sm font-medium text-stone-200 font-display">
                                  {task.title}
                                </p>
                                <p className="text-xs text-red-400/80 font-mono">
                                  Due: {task.dueDate}
                                  {task.plantInstance &&
                                    ` \u{00b7} ${task.plantInstance.nickname ?? task.plantInstance.plantReference?.commonName ?? ""}`}
                                </p>
                              </div>
                            </div>
                            <StatusBadge status={task.plantInstance?.status ?? "planned"} />
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Today */}
                {tasksDueToday.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-amber-400 font-mono mb-1.5 uppercase">
                      Today ({tasksDueToday.length})
                    </p>
                    <div className="space-y-2">
                      {tasksDueToday.map((task) => (
                        <Card key={task.id} hoverable onClick={() => navigate("/care")}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {task.plantInstance && (
                                <PlantSprite
                                  type={(task.plantInstance.plantReference?.plantType as PlantType) ?? "flower"}
                                  mood={task.plantInstance.mood}
                                  size={28}
                                />
                              )}
                              <div>
                                <p className="text-sm font-medium text-stone-200 font-display">
                                  {task.title}
                                </p>
                                <p className="text-xs text-stone-500 font-mono">
                                  {task.taskType.replace("_", " ")}
                                  {task.plantInstance &&
                                    ` \u{00b7} ${task.plantInstance.nickname ?? task.plantInstance.plantReference?.commonName ?? ""}`}
                                </p>
                              </div>
                            </div>
                            <StatusBadge status={task.plantInstance?.status ?? "planned"} />
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* This Week */}
                {thisWeekTasks.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-stone-500 font-mono mb-1.5 uppercase">
                      This Week ({thisWeekTasks.length})
                    </p>
                    <div className="space-y-2">
                      {thisWeekTasks.slice(0, 5).map((task) => (
                        <Card key={task.id} hoverable onClick={() => navigate("/care")}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {task.plantInstance && (
                                <PlantSprite
                                  type={(task.plantInstance.plantReference?.plantType as PlantType) ?? "flower"}
                                  mood={task.plantInstance.mood}
                                  size={28}
                                />
                              )}
                              <div>
                                <p className="text-sm font-medium text-stone-200 font-display">
                                  {task.title}
                                </p>
                                <p className="text-xs text-stone-500 font-mono">
                                  {formatDate(task.dueDate ?? "")}
                                  {task.plantInstance &&
                                    ` \u{00b7} ${task.plantInstance.nickname ?? task.plantInstance.plantReference?.commonName ?? ""}`}
                                </p>
                              </div>
                            </div>
                            <StatusBadge status={task.plantInstance?.status ?? "planned"} />
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Card className="text-center py-8">
                <CalendarCheck
                  className="mx-auto text-stone-600 mb-2"
                  size={32}
                />
                <p className="text-stone-400 text-sm font-display">
                  No upcoming tasks. Your plants are on autopilot!
                </p>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
