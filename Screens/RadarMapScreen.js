import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from "react-native";
import MapView, { UrlTile, PROVIDER_DEFAULT } from "react-native-maps";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");

export default function RadarMapScreen({ navigation, route }) {
  const { latitude, longitude } = route?.params || {};

  const [region, setRegion] = useState(() => {
    if (latitude != null && longitude != null) {
      return {
        latitude: Number(latitude),
        longitude: Number(longitude),
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
      };
    }
    return null;
  });

  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [radarTime, setRadarTime] = useState(null);
  const [layer, setLayer] = useState("rain"); // default layer
  const [loading, setLoading] = useState(true);

  // ✅ Location permission & Fallback coordinates
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!isMounted) return;

        if (status === "granted") {
          setHasLocationPermission(true);
          // If no specific coordinates were passed in route params, fetch current user location
          if (latitude == null || longitude == null) {
            const loc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            if (isMounted && loc?.coords) {
              setRegion({
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
                latitudeDelta: 0.5,
                longitudeDelta: 0.5,
              });
            }
          }
        } else {
          setHasLocationPermission(false);
          if (latitude == null || longitude == null) {
            // Default fallback location (Lagos)
            setRegion({
              latitude: 6.5244,
              longitude: 3.3792,
              latitudeDelta: 0.5,
              longitudeDelta: 0.5,
            });
          }
        }
      } catch (error) {
        console.warn("Location permission or fetch error:", error);
        if (isMounted && (latitude == null || longitude == null)) {
          setRegion({
            latitude: 6.5244,
            longitude: 3.3792,
            latitudeDelta: 0.5,
            longitudeDelta: 0.5,
          });
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [latitude, longitude]);

  // ✅ Fetch latest radar timestamp safely from RainViewer API
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
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchRadarTimestamps();

    return () => {
      isMounted = false;
    };
  }, []);

  // ✅ Generate tile URL based on selected layer safely
  const getTileUrl = () => {
    switch (layer) {
      case "temp":
        return `https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=7b902e22617f60503e63a449259a926d`;
      case "wind":
        return `https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=7b902e22617f60503e63a449259a926d`;
      default:
        return radarTime
          ? `https://tilecache.rainviewer.com/v2/radar/${radarTime}/256/{z}/{x}/{y}/2/1_1.png`
          : null;
    }
  };

  const tileUrl = getTileUrl();

  // ✅ Loading Screen
  if (!region || loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#00aaff" />
        <Text style={{ color: "#555", marginTop: 10 }}>Loading Radar Map...</Text>
      </View>
    );
  }

  // ✅ Main UI
  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={region}
        showsUserLocation={hasLocationPermission}
        showsCompass={true}
        showsScale={true}
      >
        {/* Live Weather Layer */}
        {tileUrl ? (
          <UrlTile
            urlTemplate={tileUrl}
            maximumZ={12}
            zIndex={1}
            tileSize={256}
          />
        ) : null}
      </MapView>

      {/* 🔙 Back Button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>

      {/* 🌦️ Map Layer Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, layer === "rain" && styles.activeButton]}
          onPress={() => setLayer("rain")}
        >
          <Text style={styles.buttonText}>Rain</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, layer === "temp" && styles.activeButton]}
          onPress={() => setLayer("temp")}
        >
          <Text style={styles.buttonText}>Temp</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, layer === "wind" && styles.activeButton]}
          onPress={() => setLayer("wind")}
        >
          <Text style={styles.buttonText}>Wind</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: width,
    height: height,
  },
  backButton: {
    position: "absolute",
    top: 50,
    left: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
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
  },
  button: {
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    paddingVertical: 10,
    paddingHorizontal: 18,
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
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
