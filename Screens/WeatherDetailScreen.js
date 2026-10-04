import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  ImageBackground,
  TouchableOpacity,
  Dimensions,
  StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import axios from "axios";

const API_KEY = "7b902e22617f60503e63a449259a926d";
const { width } = Dimensions.get("window");

const getWeatherIconInfo = (mainCondition, iconCode) => {
  const isNight = iconCode?.endsWith("n");
  const cond = mainCondition?.toLowerCase() || "";

  if (cond.includes("clear")) {
    return { name: isNight ? "moon" : "sunny", color: isNight ? "#f1f5f9" : "#ffcc00" };
  }
  if (cond.includes("cloud")) {
    if (iconCode === "02d" || iconCode === "02n") {
      return { name: isNight ? "cloudy-night" : "partly-sunny", color: isNight ? "#cbd5e1" : "#ffe066" };
    }
    return { name: "cloud", color: "#e2e8f0" };
  }
  if (cond.includes("rain") || cond.includes("drizzle")) {
    return { name: "rainy", color: "#38bdf8" };
  }
  if (cond.includes("thunder") || cond.includes("storm")) {
    return { name: "thunderstorm", color: "#c084fc" };
  }
  if (cond.includes("snow")) {
    return { name: "snow", color: "#bae6fd" };
  }
  return { name: "cloudy", color: "#94a3b8" };
};

const getAqiInfo = (aqi) => {
  switch (aqi) {
    case 1:
      return { label: "1 - Good", color: "#4ade80", rec: "Air quality is Good. Enjoy your usual outdoor activities." };
    case 2:
      return { label: "2 - Fair", color: "#facc15", rec: "Air quality is Fair. Minor respiratory issues possible for sensitive groups." };
    case 3:
      return { label: "3 - Moderate", color: "#fb923c", rec: "Air quality is Moderate. Consider reducing prolonged outdoor exertion." };
    case 4:
      return { label: "4 - Poor", color: "#f87171", rec: "Air quality is Poor. Limit outdoor activities." };
    case 5:
      return { label: "5 - Very Poor", color: "#c084fc", rec: "Air quality is Very Poor. Avoid outdoor activities." };
    default:
      return { label: "Unknown", color: "#94a3b8", rec: "" };
  }
};

const WeatherDetailScreen = ({ route, navigation }) => {
  const { city } = route.params || { city: "Abuja" };
  const [weatherData, setWeatherData] = useState(null);
  const [airQuality, setAirQuality] = useState(null);
  const [loading, setLoading] = useState(true);

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return null;
      const { coords } = await Location.getCurrentPositionAsync({});
      return coords;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const weatherRes = await axios.get(
          `https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${API_KEY}&units=metric`
        );
        setWeatherData(weatherRes.data);

        const coords = await getLocation();
        if (coords) {
          const { latitude, longitude } = coords;
          const aqiRes = await axios.get(
            `https://api.openweathermap.org/data/2.5/air_pollution?lat=${latitude}&lon=${longitude}&appid=${API_KEY}`
          );
          const aqi = aqiRes.data.list[0]?.main?.aqi;
          setAirQuality(aqi);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [city]);

  const dailyForecast = useMemo(() => {
    if (!weatherData || !weatherData.list) return [];
    const daysMap = {};

    weatherData.list.forEach((item) => {
      const date = new Date(item.dt * 1000);
      const dayKey = date.toISOString().split("T")[0];
      if (!daysMap[dayKey]) {
        daysMap[dayKey] = {
          dt: item.dt,
          dateObj: date,
          minTemp: item.main.temp_min,
          maxTemp: item.main.temp_max,
          pops: [item.pop || 0],
          weather: item.weather[0],
        };
      } else {
        daysMap[dayKey].minTemp = Math.min(daysMap[dayKey].minTemp, item.main.temp_min);
        daysMap[dayKey].maxTemp = Math.max(daysMap[dayKey].maxTemp, item.main.temp_max);
        daysMap[dayKey].pops.push(item.pop || 0);
        if (item.weather[0].main.toLowerCase().includes("rain")) {
          daysMap[dayKey].weather = item.weather[0];
        }
      }
    });

    return Object.keys(daysMap).map((key, idx) => {
      const dayData = daysMap[key];
      const maxPop = Math.max(...dayData.pops);
      const isToday = idx === 0;
      const dayName = isToday
        ? "Today"
        : dayData.dateObj.toLocaleDateString("en-US", { weekday: "short" });

      return {
        dayName,
        minTemp: Math.round(dayData.minTemp),
        maxTemp: Math.round(dayData.maxTemp),
        pop: Math.round(maxPop * 100),
        weather: dayData.weather,
        isToday,
      };
    });
  }, [weatherData]);

  const hourlyForecast = useMemo(() => {
    if (!weatherData || !weatherData.list) return [];
    return weatherData.list.slice(0, 14).map((item, idx) => {
      const date = new Date(item.dt * 1000);
      const hour = date.getHours();
      return {
        timeLabel: idx === 0 ? "Now" : `${hour}`,
        temp: Math.round(item.main.temp),
        pop: item.pop ? Math.round(item.pop * 100) : 0,
        weather: item.weather[0],
      };
    });
  }, [weatherData]);

  const overallMinMax = useMemo(() => {
    if (dailyForecast.length === 0) return { overallMin: 0, overallMax: 100 };
    const mins = dailyForecast.map((d) => d.minTemp);
    const maxs = dailyForecast.map((d) => d.maxTemp);
    return {
      overallMin: Math.min(...mins),
      overallMax: Math.max(...maxs),
    };
  }, [dailyForecast]);

  const summaryText = useMemo(() => {
    if (!weatherData || !weatherData.list || weatherData.list.length === 0) return "";
    const list = weatherData.list;
    const rainItem = list.find((item) => item.pop > 0.2);
    const maxWind = Math.round(Math.max(...list.slice(0, 8).map((i) => (i.wind?.speed || 0) * 3.6)));

    if (rainItem) {
      const popTime = new Date(rainItem.dt * 1000).getHours();
      const formattedTime = `${popTime.toString().padStart(2, "0")}:00`;
      return `Rainy conditions expected around ${formattedTime}. Wind gusts are up to ${maxWind} km/h.`;
    }
    const currentCond = list[0].weather[0].description;
    const capitalizedCond = currentCond.charAt(0).toUpperCase() + currentCond.slice(1);
    return `${capitalizedCond} conditions expected today. Wind gusts are up to ${maxWind} km/h.`;
  }, [weatherData]);

  if (loading) {
    return (
      <ImageBackground source={require("../asset/image/clearsky.jpg")} style={styles.background}>
        <LinearGradient colors={["rgba(15,60,110,0.3)", "rgba(10,35,75,0.7)"]} style={styles.gradientOverlay}>
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.loadingText}>Fetching Weather...</Text>
          </View>
        </LinearGradient>
      </ImageBackground>
    );
  }

  if (!weatherData) {
    return (
      <ImageBackground source={require("../asset/image/clearsky.jpg")} style={styles.background}>
        <LinearGradient colors={["rgba(15,60,110,0.3)", "rgba(10,35,75,0.7)"]} style={styles.gradientOverlay}>
          <View style={styles.centerContainer}>
            <Text style={styles.errorText}>Unable to load weather data.</Text>
          </View>
        </LinearGradient>
      </ImageBackground>
    );
  }

  const { city: cityData, list } = weatherData;
  const today = list[0];
  const currentTemp = Math.round(today.main.temp);
  const highTemp = Math.round(today.main.temp_max);
  const lowTemp = Math.round(today.main.temp_min);
  const conditionText = today.weather[0].description
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const feelsLike = Math.round(today.main.feels_like);
  const windSpeed = Math.round(today.wind.speed * 3.6);
  const humidity = today.main.humidity;
  const pressure = today.main.pressure;

  const aqiInfo = getAqiInfo(airQuality);

  return (
    <ImageBackground source={require("../asset/image/clearsky.jpg")} style={styles.background}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={["rgba(20,75,135,0.25)", "rgba(10,40,85,0.65)"]} style={styles.gradientOverlay}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Main Weather Header */}
          <View style={styles.headerContainer}>
            <View style={styles.cityNameRow}>
              <TouchableOpacity
                style={styles.backButton}
                activeOpacity={0.7}
                onPress={() => navigation.goBack()}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="chevron-back" size={28} color="#ffffff" />
              </TouchableOpacity>
              <Text style={styles.cityName}>{cityData.name}</Text>
            </View>
            <Text style={styles.tempText}>{currentTemp}°</Text>
            <Text style={styles.conditionText}>{conditionText}</Text>
            <Text style={styles.highLowText}>
              H:{highTemp}°  L:{lowTemp}°
            </Text>
          </View>

          {/* Card 1: Summary & Hourly Forecast */}
          <View style={styles.glassCard}>
            <Text style={styles.summaryText}>{summaryText}</Text>
            <View style={styles.cardDivider} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hourlyList}>
              {hourlyForecast.map((item, idx) => {
                const iconInfo = getWeatherIconInfo(item.weather.main, item.weather.icon);
                return (
                  <View key={idx} style={styles.hourlyItem}>
                    <Text style={styles.hourlyTime}>{item.timeLabel}</Text>
                    <View style={styles.hourlyIconContainer}>
                      <Ionicons name={iconInfo.name} size={24} color={iconInfo.color} />
                      {item.pop > 0 && (
                        <Text style={styles.hourlyPopText}>{item.pop}%</Text>
                      )}
                    </View>
                    <Text style={styles.hourlyTemp}>{item.temp}°</Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>

          {/* Card 2: 10-Day Forecast */}
          <View style={styles.glassCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.6)" />
              <Text style={styles.cardHeaderTitle}>10-DAY FORECAST</Text>
            </View>
            <View style={styles.cardDivider} />

            {dailyForecast.map((day, idx) => {
              const iconInfo = getWeatherIconInfo(day.weather.main, day.weather.icon);
              const totalRange = Math.max(overallMinMax.overallMax - overallMinMax.overallMin, 1);

              const leftRatio = Math.max(0, (day.minTemp - overallMinMax.overallMin) / totalRange);
              const widthRatio = Math.max(0.12, (day.maxTemp - day.minTemp) / totalRange);
              
              const leftPct = `${leftRatio * 100}%`;
              const widthPct = `${Math.min(1 - leftRatio, widthRatio) * 100}%`;

              const dotRatio = Math.min(1, Math.max(0, (currentTemp - overallMinMax.overallMin) / totalRange));
              const dotPct = `${dotRatio * 100}%`;

              return (
                <View key={idx} style={[styles.dailyRow, idx === dailyForecast.length - 1 && styles.noBorder]}>
                  <Text style={styles.dailyDayName}>{day.dayName}</Text>
                  
                  <View style={styles.dailyIconCell}>
                    <Ionicons name={iconInfo.name} size={22} color={iconInfo.color} />
                    {day.pop > 0 && (
                      <Text style={styles.dailyPopText}>{day.pop}%</Text>
                    )}
                  </View>

                  <Text style={styles.dailyMinTemp}>{day.minTemp}°</Text>

                  {/* Temperature Range Bar */}
                  <View style={styles.barTrackContainer}>
                    <View style={styles.barTrackBackground} />
                    <LinearGradient
                      colors={["#38bdf8", "#eab308", "#f97316"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.barFillGradient, { left: leftPct, width: widthPct }]}
                    />
                    {day.isToday && (
                      <View style={[styles.todayDot, { left: dotPct }]} />
                    )}
                  </View>

                  <Text style={styles.dailyMaxTemp}>{day.maxTemp}°</Text>
                </View>
              );
            })}
          </View>

          {/* Card 3: Air Quality (if available) */}
          {airQuality !== null && (
            <View style={styles.glassCard}>
              <View style={styles.cardHeader}>
                <Ionicons name="leaf-outline" size={14} color="rgba(255,255,255,0.6)" />
                <Text style={styles.cardHeaderTitle}>AIR QUALITY</Text>
              </View>
              <Text style={[styles.aqiValueText, { color: aqiInfo.color }]}>
                {aqiInfo.label}
              </Text>
              <View style={styles.aqiBarTrack}>
                <LinearGradient
                  colors={["#4ade80", "#facc15", "#fb923c", "#f87171", "#c084fc"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.aqiBarGradient}
                />
              </View>
              <Text style={styles.aqiRecText}>{aqiInfo.rec}</Text>
            </View>
          )}

          {/* Grid Cards: Extra Weather Details */}
          <View style={styles.gridContainer}>
            <View style={[styles.glassCard, styles.gridCard]}>
              <View style={styles.cardHeader}>
                <Ionicons name="thermometer-outline" size={14} color="rgba(255,255,255,0.6)" />
                <Text style={styles.cardHeaderTitle}>FEELS LIKE</Text>
              </View>
              <Text style={styles.gridValue}>{feelsLike}°</Text>
              <Text style={styles.gridSubText}>
                {feelsLike === currentTemp ? "Similar to actual temperature." : "Wind is making it feel cooler."}
              </Text>
            </View>

            <View style={[styles.glassCard, styles.gridCard]}>
              <View style={styles.cardHeader}>
                <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.6)" />
                <Text style={styles.cardHeaderTitle}>WIND</Text>
              </View>
              <Text style={styles.gridValue}>{windSpeed} <Text style={styles.unitText}>km/h</Text></Text>
              <Text style={styles.gridSubText}>Wind gusts up to {windSpeed + 5} km/h.</Text>
            </View>

            <View style={[styles.glassCard, styles.gridCard]}>
              <View style={styles.cardHeader}>
                <Ionicons name="water-outline" size={14} color="rgba(255,255,255,0.6)" />
                <Text style={styles.cardHeaderTitle}>HUMIDITY</Text>
              </View>
              <Text style={styles.gridValue}>{humidity}%</Text>
              <Text style={styles.gridSubText}>The dew point is {Math.round(currentTemp - (100 - humidity) / 5)}° right now.</Text>
            </View>

            <View style={[styles.glassCard, styles.gridCard]}>
              <View style={styles.cardHeader}>
                <Ionicons name="speedometer-outline" size={14} color="rgba(255,255,255,0.6)" />
                <Text style={styles.cardHeaderTitle}>PRESSURE</Text>
              </View>
              <Text style={styles.gridValue}>{pressure} <Text style={styles.unitText}>hPa</Text></Text>
              <Text style={styles.gridSubText}>Atmospheric pressure is steady.</Text>
            </View>
          </View>

        </ScrollView>

        {/* Floating Bottom Navigation Bar */}
        <View style={styles.bottomNavContainer}>
          <TouchableOpacity
            style={styles.navIconButton}
            activeOpacity={0.7}
            onPress={() => navigation.navigate("RadarMapScreen", { latitude: cityData.coord.lat, longitude: cityData.coord.lon })}
          >
            <Ionicons name="map-outline" size={22} color="#ffffff" />
          </TouchableOpacity>

          {/* Pagination Pill */}
          <View style={styles.paginationPill}>
            <Ionicons name="location" size={12} color="#ffffff" style={styles.dotMargin} />
            <View style={styles.dotInactive} />
            <View style={styles.dotInactive} />
            <View style={styles.dotInactive} />
            <View style={styles.dotInactive} />
          </View>

          <TouchableOpacity
            style={styles.navIconButton}
            activeOpacity={0.7}
            onPress={() => navigation.navigate("HomeScreen")}
          >
            <Ionicons name="list-outline" size={22} color="#ffffff" />
          </TouchableOpacity>
        </View>

      </LinearGradient>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  gradientOverlay: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#ffffff",
    marginTop: 12,
    fontSize: 16,
    fontWeight: "500",
  },
  errorText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "500",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 110,
  },

  /* Header */
  headerContainer: {
    alignItems: "center",
    marginBottom: 30,
  },
  cityNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    width: "100%",
    marginBottom: 4,
  },
  backButton: {
    position: "absolute",
    left: 0,
    paddingRight: 8,
  },
  cityName: {
    fontSize: 34,
    fontWeight: "400",
    color: "#ffffff",
    letterSpacing: 0.3,
  },
  tempText: {
    fontSize: 88,
    fontWeight: "200",
    color: "#ffffff",
    marginVertical: -6,
  },
  conditionText: {
    fontSize: 19,
    fontWeight: "500",
    color: "rgba(255,255,255,0.9)",
    marginBottom: 4,
  },
  highLowText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },

  /* Glass Cards */
  glassCard: {
    backgroundColor: "rgba(12, 52, 102, 0.42)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    padding: 16,
    marginBottom: 16,
  },
  summaryText: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.95)",
    lineHeight: 20,
    fontWeight: "400",
  },
  cardDivider: {
    height: 0.5,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    marginVertical: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  cardHeaderTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.6)",
    letterSpacing: 0.8,
    marginLeft: 6,
  },

  /* Hourly List */
  hourlyList: {
    paddingRight: 10,
  },
  hourlyItem: {
    width: 60,
    alignItems: "center",
    marginRight: 12,
  },
  hourlyTime: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 8,
  },
  hourlyIconContainer: {
    height: 42,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  hourlyPopText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#38bdf8",
    marginTop: 2,
  },
  hourlyTemp: {
    fontSize: 19,
    fontWeight: "600",
    color: "#ffffff",
  },

  /* 10-Day Daily List */
  dailyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255, 255, 255, 0.12)",
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  dailyDayName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    width: 70,
  },
  dailyIconCell: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  dailyPopText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#38bdf8",
    marginTop: 1,
  },
  dailyMinTemp: {
    fontSize: 16,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.75)",
    width: 34,
    textAlign: "right",
  },
  dailyMaxTemp: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    width: 34,
    textAlign: "left",
  },

  /* Bar Track */
  barTrackContainer: {
    flex: 1,
    height: 4,
    marginHorizontal: 12,
    justifyContent: "center",
    position: "relative",
  },
  barTrackBackground: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0, 20, 50, 0.45)",
  },
  barFillGradient: {
    position: "absolute",
    height: 4,
    borderRadius: 2,
  },
  todayDot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#f97316",
    top: -2,
    marginLeft: -4,
    shadowColor: "#ffffff",
    shadowRadius: 4,
    shadowOpacity: 0.8,
  },

  /* AQI */
  aqiValueText: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 6,
    marginBottom: 10,
  },
  aqiBarTrack: {
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "rgba(0,0,0,0.2)",
    marginBottom: 10,
    overflow: "hidden",
  },
  aqiBarGradient: {
    flex: 1,
    borderRadius: 2.5,
  },
  aqiRecText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
    lineHeight: 18,
  },

  /* Grid Cards */
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  gridCard: {
    width: (width - 52) / 2,
    minHeight: 110,
  },
  gridValue: {
    fontSize: 26,
    fontWeight: "600",
    color: "#ffffff",
    marginTop: 8,
    marginBottom: 4,
  },
  unitText: {
    fontSize: 16,
    fontWeight: "400",
  },
  gridSubText: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.8)",
    lineHeight: 16,
  },

  /* Floating Navigation Bar */
  bottomNavContainer: {
    position: "absolute",
    bottom: 25,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  navIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(10, 45, 95, 0.65)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  paginationPill: {
    height: 32,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: "rgba(10, 45, 95, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  dotMargin: {
    marginRight: 6,
  },
  dotInactive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    marginHorizontal: 3,
  },
});

export default WeatherDetailScreen;
