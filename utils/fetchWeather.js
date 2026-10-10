import axios from "axios";
import { OPENWEATHER_API_KEY as API_KEY } from "./config";

const fetchWeather = async (cities) => {
  try {
    const data = await Promise.all(
      cities.map(async (city) => {
        const response = await axios.get(
          `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${API_KEY}&units=imperial`
        );
        return {
          name: city,
          temp: Math.round(response.data.main.temp),
          weather: response.data.weather[0].main,
          high: Math.round(response.data.main.temp_max),
          low: Math.round(response.data.main.temp_min),
        };
      })
    );
    return data;
  } catch (error) {
    console.error("Error fetching weather data:", error);
    return [];
  }
};

export default fetchWeather;
