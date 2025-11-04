import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

function App() {
  const [data, setData] = useState([]);

  const channelId = 3145537; // Tu canal de ThingSpeak
  const readAPIKey = "JB38PVPETXKWEJF3"; // Tu API Key de lectura
  const url = `https://api.thingspeak.com/channels/${channelId}/feeds.json?results=20`;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(url);
        const json = await response.json();
        const feeds = json.feeds.map(feed => ({
          fecha: feed.created_at.slice(11, 19),
          humedad: parseFloat(feed.field1),
          temperatura: parseFloat(feed.field2)
        }));
        setData(feeds);
      } catch (error) {
        console.error("Error al obtener datos:", error);
      }
    };

    fetchData();
    const intervalo = setInterval(fetchData, 20000); // actualiza cada 20 seg
    return () => clearInterval(intervalo);
  }, [url]);

  const ultimo = data[data.length - 1];

  return (
    <div style={{ textAlign: "center", fontFamily: "sans-serif", padding: 20 }}>
      <h1>🌦️ Estación IoT ESP8266 + DHT22</h1>
      {ultimo ? (
        <>
          <h2>Temperatura: {ultimo.temperatura} °C</h2>
          <h2>Humedad: {ultimo.humedad} %</h2>
        </>
      ) : (
        <p>Cargando datos desde ThingSpeak...</p>
      )}

      <div style={{ width: "100%", height: 400, marginTop: 40 }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <Line type="monotone" dataKey="temperatura" stroke="#ff7300" name="Temperatura (°C)" />
            <Line type="monotone" dataKey="humedad" stroke="#007aff" name="Humedad (%)" />
            <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
            <XAxis dataKey="fecha" />
            <YAxis />
            <Tooltip />
            <Legend />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default App;
