import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { WebView } from "react-native-webview";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { OPENWEATHER_API_KEY } from "../utils/config";

const { width, height } = Dimensions.get("window");

export default function RadarMapScreen({ navigation, route }) {
  const { latitude, longitude } = route?.params || {};
  const webViewRef = useRef(null);

  const parsedLat = Number(latitude);
  const parsedLon = Number(longitude);
  const isValidCoord =
    latitude != null &&
    longitude != null &&
    !isNaN(parsedLat) &&
    !isNaN(parsedLon) &&
    isFinite(parsedLat) &&
    isFinite(parsedLon);

  const defaultLat = 6.5244;
  const defaultLon = 3.3792;

  const [coords, setCoords] = useState(() => {
    if (isValidCoord) {
      return { lat: parsedLat, lon: parsedLon };
    }
    return null;
  });

  const [radarTime, setRadarTime] = useState(null);
  const [layer, setLayer] = useState("rain");

  // ✅ Location permission & Fallback coordinates with timeout guard
  useEffect(() => {
    let isMounted = true;
    const fallbackTimer = setTimeout(() => {
      if (isMounted) {
        setCoords((prev) => prev || { lat: defaultLat, lon: defaultLon });
      }
    }, 3000);

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!isMounted) return;

        if (status === "granted" && !isValidCoord) {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          if (isMounted && loc?.coords) {
            setCoords({ lat: loc.coords.latitude, lon: loc.coords.longitude });
          }
        } else if (!isValidCoord && isMounted) {
          setCoords({ lat: defaultLat, lon: defaultLon });
        }
      } catch (error) {
        console.warn("Location permission or fetch error:", error);
        if (isMounted && !isValidCoord) {
          setCoords({ lat: defaultLat, lon: defaultLon });
        }
      }
    })();

    return () => {
      isMounted = false;
      clearTimeout(fallbackTimer);
    };
  }, [latitude, longitude]);

  // ✅ Fetch latest RainViewer radar timestamp
  useEffect(() => {
    let isMounted = true;
    const fetchRadarTimestamps = async () => {
      try {
        const res = await fetch("https://tilecache.rainviewer.com/api/maps.json");
        if (res.ok) {
          const timestamps = await res.json();
          if (Array.isArray(timestamps) && timestamps.length > 0) {
            const latest = timestamps[timestamps.length - 1];
            if (isMounted) setRadarTime(latest);
          }
        }
      } catch (error) {
        console.error("Error fetching radar timestamps:", error);
      }
    };
    fetchRadarTimestamps();

    return () => {
      isMounted = false;
    };
  }, []);

  const activeLat = coords?.lat || defaultLat;
  const activeLon = coords?.lon || defaultLon;

  // ✅ Switch layer inside Leaflet WebView dynamically
  const handleLayerChange = (newLayer) => {
    setLayer(newLayer);
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(
        `if (typeof setLayer === 'function') { setLayer("${newLayer}", "${radarTime || ""}"); } true;`
      );
    }
  };

  // ✅ 100% Free OpenStreetMap & CartoDB Dark Leaflet HTML Template
  const leafletHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background-color: #161c24; }
        .leaflet-control-attribution { display: none !important; }
        .custom-marker {
          background-color: #00aaff;
          border: 3px solid #ffffff;
          border-radius: 50%;
          width: 18px;
          height: 18px;
          box-shadow: 0 0 12px rgba(0,170,255,0.9);
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', {
          zoomControl: false,
          attributionControl: false
        }).setView([${activeLat}, ${activeLon}], 8);

        // 100% Free Basemap without API Keys or Watermarks (Esri World Dark Gray Canvas)
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 16
        }).addTo(map);

        // Custom pin marker at target location
        var customIcon = L.divIcon({ className: 'custom-marker', iconSize: [18, 18], iconAnchor: [9, 9] });
        L.marker([${activeLat}, ${activeLon}], { icon: customIcon }).addTo(map);

        var weatherLayer = null;
        var openWeatherKey = "${OPENWEATHER_API_KEY}";

        function setLayer(layerType, radarTs) {
          if (weatherLayer) {
            map.removeLayer(weatherLayer);
          }
          var tileUrl = "";
          if (layerType === "temp") {
            tileUrl = "https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=" + openWeatherKey;
          } else if (layerType === "wind") {
            tileUrl = "https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=" + openWeatherKey;
          } else {
            if (radarTs) {
              tileUrl = "https://tilecache.rainviewer.com/v2/radar/" + radarTs + "/256/{z}/{x}/{y}/2/1_1.png";
            } else {
              tileUrl = "https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=" + openWeatherKey;
            }
          }
          if (tileUrl) {
            weatherLayer = L.tileLayer(tileUrl, { opacity: 0.8, zIndex: 100 });
            weatherLayer.addTo(map);
          }
        }

        setLayer("${layer}", "${radarTime || ""}");
      </script>
    </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#161c24" />

      {/* 🗺️ Leaflet Map inside WebView (100% Free & No API Keys Required) */}
      <WebView
        ref={webViewRef}
        originWhitelist={["*"]}
        source={{ html: leafletHtml }}
        style={styles.map}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#00aaff" />
            <Text style={{ color: "#aaa", marginTop: 10 }}>Loading Radar Map...</Text>
          </View>
        )}
      />

      {/* 🔙 Back Button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        activeOpacity={0.7}
      >
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>

      {/* 🌦️ Map Layer Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, layer === "rain" && styles.activeButton]}
          onPress={() => handleLayerChange("rain")}
        >
          <Text style={[styles.buttonText, layer === "rain" && styles.activeButtonText]}>Rain</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, layer === "temp" && styles.activeButton]}
          onPress={() => handleLayerChange("temp")}
        >
          <Text style={[styles.buttonText, layer === "temp" && styles.activeButtonText]}>Temp</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, layer === "wind" && styles.activeButton]}
          onPress={() => handleLayerChange("wind")}
        >
          <Text style={[styles.buttonText, layer === "wind" && styles.activeButtonText]}>Wind</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#161c24",
  },
  map: {
    width: width,
    height: height,
    backgroundColor: "#161c24",
  },
  backButton: {
    position: "absolute",
    top: 50,
    left: 20,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 10,
    borderRadius: 25,
    zIndex: 10,
  },
  buttonContainer: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    zIndex: 10,
  },
  button: {
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginHorizontal: 5,
  },
  activeButton: {
    backgroundColor: "#00aaff",
  },
  buttonText: {
    color: "#000",
    fontWeight: "600",
  },
  activeButtonText: {
    color: "#fff",
  },
  loaderContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#161c24",
    zIndex: 5,
  },
});
