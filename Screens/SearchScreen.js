import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { OPENWEATHER_API_KEY as API_KEY } from "../utils/config";

// Geocoding API search
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

const SearchScreen = ({ route, navigation }) => {
  const myLocationName = route.params?.myLocationName || "Uvwie";
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const inputRef = useRef(null);
  const debounceTimer = useRef(null);

  // Focus keyboard immediately when screen mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Debounced geocode search
  useEffect(() => {
    clearTimeout(debounceTimer.current);
    if (!query.trim()) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }
    setSuggestionsLoading(true);
    debounceTimer.current = setTimeout(async () => {
      const results = await geocodeSearch(query);
      setSuggestions(results);
      setSuggestionsLoading(false);
    }, 350);
    return () => clearTimeout(debounceTimer.current);
  }, [query]);

  const handleSelectCity = (cityName) => {
    Keyboard.dismiss();
    navigation.navigate("WeatherDetailScreen", { city: cityName });
  };

  const renderSuggestionRow = ({ item }) => {
    const locationSubtitle = [item.state, item.country].filter(Boolean).join(", ");
    return (
      <TouchableOpacity
        style={styles.suggestionRow}
        activeOpacity={0.7}
        onPress={() => handleSelectCity(item.name)}
      >
        <Ionicons name="location-outline" size={18} color="#8e8e93" style={styles.rowIcon} />
        <View style={styles.suggestionTextContainer}>
          <Text style={styles.suggestionTitle}>{item.name}</Text>
          {locationSubtitle ? (
            <Text style={styles.suggestionSubtitle}>{locationSubtitle}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <StatusBar style="light" backgroundColor="#000000" />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        {/* Main Content Area */}
        <View style={styles.contentContainer}>
          {query.trim().length === 0 ? (
            /* Suggested Section (Empty Query) */
            <View style={styles.suggestedSection}>
              <Text style={styles.sectionHeader}>SUGGESTED</Text>
              
              <TouchableOpacity
                style={styles.homeRow}
                activeOpacity={0.7}
                onPress={() => handleSelectCity(myLocationName)}
              >
                <View style={styles.homeIconTitleRow}>
                  <Ionicons name="home" size={18} color="#ffffff" style={styles.homeIcon} />
                  <Text style={styles.homeTitle}>Home</Text>
                </View>
                <Text style={styles.homeSubtitle}>{myLocationName}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Live Search Results */
            <View style={styles.resultsSection}>
              {suggestionsLoading ? (
                <ActivityIndicator size="small" color="#8e8e93" style={{ marginTop: 24 }} />
              ) : (
                <FlatList
                  data={suggestions}
                  keyExtractor={(item, idx) => `${item.name}-${item.lat}-${idx}`}
                  renderItem={renderSuggestionRow}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                />
              )}
            </View>
          )}
        </View>

        {/* Bottom Search Bar Area */}
        <View style={styles.bottomBarRow}>
          {/* Search Pill */}
          <View style={styles.searchPill}>
            <Ionicons name="search" size={18} color="rgba(255, 255, 255, 0.6)" style={styles.searchIcon} />
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              placeholder="Search for a city or airport"
              placeholderTextColor="rgba(255, 255, 255, 0.4)"
              value={query}
              onChangeText={setQuery}
              autoFocus={true}
              keyboardAppearance="dark"
              returnKeyType="search"
              autoCorrect={false}
              onSubmitEditing={() => {
                if (suggestions.length > 0) {
                  handleSelectCity(suggestions[0].name);
                } else if (query.trim()) {
                  handleSelectCity(query.trim());
                }
              }}
            />
            {query.length > 0 ? (
              <TouchableOpacity
                onPress={() => setQuery("")}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <View style={styles.clearBtn}>
                  <Ionicons name="close" size={12} color="#000000" />
                </View>
              </TouchableOpacity>
            ) : (
              <Ionicons name="mic-outline" size={20} color="rgba(255, 255, 255, 0.6)" />
            )}
          </View>

          {/* Circular Close (X) Button */}
          <TouchableOpacity
            style={styles.closeButton}
            activeOpacity={0.7}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="close" size={22} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  keyboardView: {
    flex: 1,
    justify: "space-between",
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },

  /* Suggested Section */
  suggestedSection: {
    paddingTop: 8,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6c6c70",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  homeRow: {
    paddingVertical: 4,
  },
  homeIconTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  homeIcon: {
    marginRight: 8,
  },
  homeTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
  },
  homeSubtitle: {
    fontSize: 15,
    color: "#8e8e93",
    marginTop: 2,
    marginLeft: 26,
  },

  /* Search Results */
  resultsSection: {
    flex: 1,
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  rowIcon: {
    marginRight: 12,
  },
  suggestionTextContainer: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  suggestionSubtitle: {
    fontSize: 13,
    color: "#8e8e93",
    marginTop: 2,
  },

  /* Bottom Search Bar Area */
  bottomBarRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 10 : 16,
  },
  searchPill: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1c1e22",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 16,
    paddingVertical: 6,
  },
  clearBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1c1e22",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
});

export default SearchScreen;
