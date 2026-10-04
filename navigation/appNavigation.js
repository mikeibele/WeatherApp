// appNavigation.js
import * as React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "../Screens/HomeScreen";
import WeatherDetailScreen from "../Screens/WeatherDetailScreen";
import RadarMapScreen from "../Screens/RadarMapScreen";
import SearchScreen from "../Screens/SearchScreen";

const Stack = createNativeStackNavigator();

function AppNavigation() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="HomeScreen">
            <Stack.Screen name="HomeScreen" component={HomeScreen} />
            <Stack.Screen name="SearchScreen" component={SearchScreen} options={{ animation: "fade" }} />
            <Stack.Screen name="WeatherDetailScreen" component={WeatherDetailScreen} />
            <Stack.Screen name="RadarMapScreen" component={RadarMapScreen} options={{ title: "Live Radar" }} />

        </Stack.Navigator>
    );
}

export default AppNavigation;
