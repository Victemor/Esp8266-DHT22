#include <ESP8266WiFi.h>
#include "ThingSpeak.h"
#include "DHT.h"

#define DHTPIN D3          // Pin donde está conectado el sensor
#define DHTTYPE DHT22      // Tipo de sensor

const char* ssid = "ifmachado";           // Reemplaza con el nombre de tu red WiFi
const char* password = "";   // Reemplaza con tu contraseña WiFi
unsigned long myChannelNumber = 3145537; // Ej: 1234567
const char* myWriteAPIKey = "NMKR9MC4IXMHP2JV";           // Tu clave de escritura de ThingSpeak

WiFiClient client;
DHT dht(DHTPIN, DHTTYPE);

void setup() {
  Serial.begin(9600);
  WiFi.begin(ssid, password);
  Serial.print("Conectando a WiFi");
  Serial.println("SSID: " + String(ssid));
  Serial.println("PASS: " + String(password));
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.print(".");
  }

  Serial.println("\nConectado a WiFi");
  ThingSpeak.begin(client);
  dht.begin();
}

void loop() {
  
  float humedad = dht.readHumidity();
  float temperatura = dht.readTemperature();

  if (isnan(humedad) || isnan(temperatura)) {
    Serial.println("Error al leer el sensor DHT!");
    return;
  }

  Serial.print("Temperatura: ");
  Serial.print(temperatura);
  Serial.print(" °C  |  Humedad: ");
  Serial.print(humedad);
  Serial.println(" %");

  ThingSpeak.setField(1, humedad);
  ThingSpeak.setField(2, temperatura);

  int x = ThingSpeak.writeFields(myChannelNumber, myWriteAPIKey);

  if (x == 200) {
    Serial.println("Datos enviados correctamente a ThingSpeak");
  } else {
    Serial.println("Error al enviar datos. Código HTTP: " + String(x));
  }

  delay(20000); // ThingSpeak permite una actualización cada 15 segundos mínimo
}
