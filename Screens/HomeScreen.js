import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Keyboard,
  Animated,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import * as Location from "expo-location";
import { useNavigation } from "@react-navigation/native";

const API_KEY = "7b902e22617f60503e63a449259a926d";

// ─── Helpers ────────────────────────────────────────────────────────────────

const getCityLocalTime = (timezoneOffsetSeconds) => {
  if (timezoneOffsetSeconds == null) return "";
  const utcNow = Date.now() + new Date().getTimezoneOffset() * 60000;
  const local = new Date(utcNow + timezoneOffsetSeconds * 1000);
  const h = local.getHours().toString().padStart(2, "0");
  const m = local.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
};

const getCardGradientColors = (weatherMain, iconCode, weatherDesc = "") => {
  const isNight = iconCode?.endsWith("n");
  const main = (weatherMain || "").toLowerCase();
  const desc = (weatherDesc || "").toLowerCase();

  // Thunderstorm / Storm
  if (main.includes("thunder") || main.includes("storm") || desc.includes("thunder") || desc.includes("storm")) {
    return isNight ? ["#1A0B2E", "#3B0764"] : ["#311B92", "#5B21B6"];
  }

  // Rain / Drizzle
  if (main.includes("rain") || main.includes("drizzle") || desc.includes("rain") || desc.includes("drizzle")) {
    return isNight ? ["#0B132B", "#1C2541"] : ["#1E3A8A", "#0284C7"];
  }

  // Clear / Sunny
  if (main.includes("clear") || main.includes("sun") || desc.includes("clear") || desc.includes("sun")) {
    return isNight ? ["#0F172A", "#1E1B4B"] : ["#2563EB", "#F59E0B"];
  }

  // Clouds / Overcast
  if (main.includes("cloud") || desc.includes("cloud")) {
    return isNight ? ["#111827", "#1F2937"] : ["#334155", "#64748B"];
  }

  // Snow
  if (main.includes("snow") || desc.includes("snow")) {
    return isNight ? ["#0F172A", "#0369A1"] : ["#0284C7", "#7DD3FC"];
  }

  // Mist / Fog / Haze / Dust
  if (main.includes("fog") || main.includes("mist") || main.includes("haze") || main.includes("dust")) {
    return isNight ? ["#1E293B", "#334155"] : ["#475569", "#94A3B8"];
  }

  // Fallback default
  return isNight ? ["#1c2135", "#101626"] : ["#2563EB", "#3B82F6"];
};

// ─── API calls ───────────────────────────────────────────────────────────────

const fetchWeather = async (cityName) => {
  try {
    const { data: d } = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cityName)}&appid=${API_KEY}&units=metric`
    );
    const weatherMain = d.weather[0].main;
    const desc = d.weather[0].description
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    return {
      name: d.name,
      temp: Math.round(d.main.temp),
      high: Math.round(d.main.temp_max),
      low: Math.round(d.main.temp_min),
      weather: desc || weatherMain,
      weatherMain,
      icon: d.weather[0].icon,
      timezone: d.timezone,
      isMyLocation: false,
    };
  } catch {
    return null;
  }
};

const fetchWeatherByCoords = async () => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;
    const { coords } = await Location.getCurrentPositionAsync({});
    const { data: d } = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?lat=${coords.latitude}&lon=${coords.longitude}&appid=${API_KEY}&units=metric`
    );
    const weatherMain = d.weather[0].main;
    const desc = d.weather[0].description
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    return {
      name: d.name,
      temp: Math.round(d.main.temp),
      high: Math.round(d.main.temp_max),
      low: Math.round(d.main.temp_min),
      weather: desc || weatherMain,
      weatherMain,
      icon: d.weather[0].icon,
      timezone: d.timezone,
      isMyLocation: true,
    };
  } catch {
    return null;
  }
};

// Geocoding: returns [{name, state, country, displayName}]
const geocodeSearch = async (query) => {
  if (!query.trim()) return [];
  try {
    const { data } = await axios.get(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=8&appid=${API_KEY}`
    );
    return data.map((item) => ({
      name: item.name,
      state: item.state || "",
      country: item.country || "",
      lat: item.lat,
      lon: item.lon,
    }));
  } catch {
    return [];
  }
};

// ─── Component ───────────────────────────────────────────────────────────────

const HomeScreen = () => {
  const initialCities = ["Abuja", "Asaba", "Anambra", "Kano"];

  const [weatherData, setWeatherData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search state
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const searchInputRef = useRef(null);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const debounceTimer = useRef(null);

  const navigation = useNavigation();

  // ── Initial data fetch ──────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      const [locationWeather, ...cityWeathers] = await Promise.all([
        fetchWeatherByCoords(),
        ...initialCities.map(fetchWeather),
      ]);
      const valid = cityWeathers.filter(Boolean);
      setWeatherData(locationWeather ? [locationWeather, ...valid] : valid);
      setLoading(false);
    })();
  }, []);

  // ── Debounced geocode ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isSearchActive) return;
    clearTimeout(debounceTimer.current);
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    setSuggestionsLoading(true);
    debounceTimer.current = setTimeout(async () => {
      const results = await geocodeSearch(query);
      setSuggestions(results);
      setSuggestionsLoading(false);
    }, 350);
    return () => clearTimeout(debounceTimer.current);
  }, [query, isSearchActive]);

  // ── Open / close search overlay ─────────────────────────────────────────
  const openSearch = useCallback(() => {
    setIsSearchActive(true);
    setQuery("");
    setSuggestions([]);
    Animated.timing(overlayOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      searchInputRef.current?.focus();
    });
  }, [overlayOpacity]);

  const closeSearch = useCallback(() => {
    Keyboard.dismiss();
    Animated.timing(overlayOpacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setIsSearchActive(false);
      setQuery("");
      setSuggestions([]);
    });
  }, [overlayOpacity]);

  // ── Select a suggestion ─────────────────────────────────────────────────
  const handleSelectSuggestion = useCallback(
    async (suggestion) => {
      closeSearch();
      // Navigate immediately using the name; WeatherDetailScreen fetches by name
      navigation.navigate("WeatherDetailScreen", { city: suggestion.name });
      // Optionally add to home list
      const data = await fetchWeather(suggestion.name);
      if (data) {
        setWeatherData((prev) => {
          const exists = prev.some((d) => d.name === data.name);
          return exists ? prev : [data, ...prev];
        });
      }
    },
    [closeSearch, navigation]
  );

  // ── City card ────────────────────────────────────────────────────────────
  const renderCityCard = ({ item }) => {
    const gradientColors = getCardGradientColors(item.weatherMain, item.icon, item.weather);
    const subtitle = item.isMyLocation
      ? "My Location • 🏠 Home"
      : getCityLocalTime(item.timezone);

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.cardContainer}
        onPress={() => navigation.navigate("WeatherDetailScreen", { city: item.name })}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardGradient}
        >
          <View style={styles.cardLeft}>
            <Text style={styles.cityNameText} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.subtitleText}>{subtitle}</Text>
            <Text style={styles.conditionText} numberOfLines={1}>{item.weather}</Text>
          </View>
          <View style={styles.cardRight}>
            <Text style={styles.tempText}>{item.temp}°</Text>
            <Text style={styles.highLowText}>H:{item.high}°  L:{item.low}°</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  // ── Suggestion row ───────────────────────────────────────────────────────
  const renderSuggestion = ({ item, index }) => {
    const parts = [item.state, item.country].filter(Boolean).join(", ");
    return (
      <TouchableOpacity
        style={[styles.suggestionRow, index === 0 && styles.suggestionRowFirst]}
        activeOpacity={0.7}
        onPress={() => handleSelectSuggestion(item)}
      >
        <Text style={styles.suggestionName} numberOfLines={1}>
          <Text style={styles.suggestionNameBold}>{item.name}</Text>
          {parts ? (
            <Text style={styles.suggestionNameLight}>{`, ${parts}`}</Text>
          ) : null}
        </Text>
      </TouchableOpacity>
    );
  };

  // ── Loading screen ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" backgroundColor="#161c24" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.loadingText}>Loading Weather…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" backgroundColor="#161c24" animated={true} />
      {/* City cards list */}
      <View style={styles.container}>
        <FlatList
          data={weatherData}
          keyExtractor={(item, idx) => `${item.name}-${idx}`}
          renderItem={renderCityCard}
          ListHeaderComponent={
            <View style={styles.topHeader}>
              <Text style={styles.headerTitle}> Weather </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />

        {/* Static search pill (tap to open SearchScreen) */}
        <View style={styles.bottomSearchContainer}>
          <TouchableOpacity
            style={styles.searchBarPill}
            activeOpacity={0.85}
            onPress={() => {
              const myLoc = weatherData.find((d) => d.isMyLocation)?.name || "Uvwie";
              navigation.navigate("SearchScreen", { myLocationName: myLoc });
            }}
          >
            <Ionicons name="search" size={18} color="rgba(255,255,255,0.6)" style={styles.searchIcon} />
            <Text style={styles.searchPlaceholder}>Search for a city or airport</Text>
            <Ionicons name="mic-outline" size={18} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#161c24",
  },
  container: {
    flex: 1,
    backgroundColor: "#161c24",
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#161c24",
  },
  loadingText: {
    color: "#ffffff",
    marginTop: 12,
    fontSize: 16,
    fontWeight: "500",
  },

  /* Header (non-sticky, inside FlatList) */
  topHeader: {
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: "bold",
    color: "#ffffff",
    letterSpacing: 0.3,
  },

  /* City Cards */
  listContent: {
    paddingBottom: 90,
  },
  cardContainer: {
    marginBottom: 12,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  cardGradient: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 18,
    minHeight: 110,
    borderRadius: 20,
  },
  cardLeft: {
    flex: 1,
    justifyContent: "space-between",
    paddingRight: 10,
  },
  cardRight: {
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  cityNameText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.2,
  },
  subtitleText: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(255,255,255,0.75)",
    marginTop: 2,
    marginBottom: 14,
  },
  conditionText: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.95)",
  },
  tempText: {
    fontSize: 48,
    fontWeight: "200",
    color: "#ffffff",
    marginTop: -6,
  },
  highLowText: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.9)",
    marginTop: 10,
  },

  /* Static search pill */
  bottomSearchContainer: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 16,
  },
  searchBarPill: {
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(40,52,68,0.9)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchPlaceholder: {
    flex: 1,
    color: "rgba(255,255,255,0.4)",
    fontSize: 16,
  },

  /* Search Overlay */
  searchOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0a0e14",
    justifyContent: "flex-end",
    paddingBottom: Platform.OS === "ios" ? 10 : 16,
  },
  suggestionsContainer: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: "flex-end",
  },
  suggestionRow: {
    paddingVertical: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  suggestionRowFirst: {
    borderTopWidth: 0,
  },
  suggestionName: {
    fontSize: 17,
    lineHeight: 22,
  },
  suggestionNameBold: {
    fontWeight: "700",
    color: "#ffffff",
  },
  suggestionNameLight: {
    fontWeight: "400",
    color: "rgba(255,255,255,0.55)",
  },

  /* Overlay search row */
  overlaySearchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  overlaySearchPill: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(40,52,68,0.95)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  overlaySearchInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 16,
    paddingVertical: 6,
  },
  clearButton: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },
});

export default HomeScreen;
