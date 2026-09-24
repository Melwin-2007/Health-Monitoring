/*
  Smart Air Quality Monitor - ESP32 DevKit V1
  Sensors : SHT30 (I2C), MQ135, MQ7, Sharp GP2Y1010AU0F dust sensor, red alert LED
  Libraries: "Adafruit SHT31 Library" (installs Adafruit BusIO). Everything else is built in.
  Serial  : 115200 baud. Send 'c' to recalibrate (do it in fresh air).
*/

#include <Wire.h>
#include <Adafruit_SHT31.h>
#include <Preferences.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <math.h>

// ============================ PINS ============================
#define PIN_SDA        21   // SHT30 SDA
#define PIN_SCL        22   // SHT30 SCL
#define PIN_MQ7        34   // "MQ gas" AO (CO sensor), ADC1 input only
#define PIN_MQ135      35   // "MQ air-quality" AO (MQ135), ADC1 input only
#define PIN_DUST_AO    32   // ADC1 (through divider)
#define PIN_DUST_LED   25   // dust sensor LED control (active LOW)
#define PIN_ALERT_LED  26   // red LED + 220 ohm resistor

// ======================== HARDWARE VALUES =====================
const float DIV_RATIO      = 1.0f;   // 1.0 = NO divider fitted (use 0.5 if you add 10k+10k dividers)
const float VCC_SENSOR     = 5.0f;   // MQ supply voltage; no multimeter, so 5.0 is used (calibration cancels most of the error)
const float MQ135_RL_KOHM  = 1.0f;   // load resistor marked 102 = 1k (103 = 10k)
const float MQ7_RL_KOHM    = 1.0f;   // change to 10.0 if the MQ7 module's resistor is marked 103
const int   CAL_VERSION    = 2;      // bump to force an automatic recalibration on next boot

// ======================= CALIBRATION DATA =====================
// MQ135 CO2 curve: ppm = A * (Rs/R0)^B   (R0 is found automatically in fresh air)
const float MQ135_A = 116.6020682f, MQ135_B = -2.769034857f;
const float MQ135_CLEAN_PPM = 420.0f;   // assumed outdoor CO2 during calibration
// MQ7 CO curve: ppm = A * (Rs/R0)^B ; datasheet clean-air ratio Rs/R0 = 27.5
const float MQ7_A = 99.042f, MQ7_B = -1.518f;
const float MQ7_CLEAN_RATIO = 27.5f;
// Dust: GP2Y1010AU0F sensitivity ~0.17 mg/m3 per volt above clean-air baseline
const float DUST_UG_PER_VOLT = 170.0f;

// SHT30 manual trim (compare against a reference thermometer / hygrometer)
const float TEMP_OFFSET_C = 0.0f;
const float RH_OFFSET     = 0.0f;

const uint32_t WARMUP_SECONDS = 120;    // MQ preheat before calibrating (longer is better)
const uint32_t SAMPLE_MS      = 2000;
#define DEBUG_RAW true                  // print raw voltages and Rs for troubleshooting

// ========================= VALID RANGES =======================
const float T_MIN = -40,  T_MAX = 125;   // SHT30 spec
const float H_MIN = 0,    H_MAX = 100;
const float CO2_MIN = 400, CO2_MAX = 5000;  // MQ135 estimate, clamped
const float CO_MIN = 0,   CO_MAX = 2000;    // MQ7 spec 20-2000 ppm
const float PM_MIN = 0,   PM_MAX = 500;     // GP2Y1010 spec 0-0.5 mg/m3

// ============================ WIFI ============================
#define ENABLE_WIFI true
const char* WIFI_SSID  = "PETER";
const char* WIFI_PASS  = "PETER123";
const char* SERVER_URL = "http://192.168.1.39:8000/api/iot/ingest";  // laptop IP, port 8000

// ============================ STATE ===========================
Adafruit_SHT31 sht = Adafruit_SHT31();
Preferences prefs;

float r0_mq135 = 0, r0_mq7 = 0, dustV0 = 0.6f;
bool  shtOk = false;
int   level = 0;   // 0 GOOD, 1 MODERATE, 2 POOR, 3 HAZARDOUS
const char* LEVEL_NAME[] = {"GOOD", "MODERATE", "POOR", "HAZARDOUS"};

// ======================== SENSOR HELPERS ======================
float readMilliVolts(int pin, int samples = 32) {
  uint32_t sum = 0;
  for (int i = 0; i < samples; i++) { sum += analogReadMilliVolts(pin); delayMicroseconds(200); }
  return sum / (float)samples;
}

// Voltage at the sensor's AO pin (undo the divider)
float sensorVolts(int pin) { return readMilliVolts(pin) / 1000.0f / DIV_RATIO; }

float calcRs(float v, float rlKohm) {
  if (v < 0.02f) v = 0.02f;
  float rs = rlKohm * (VCC_SENSOR - v) / v;
  return rs < 0.01f ? 0.01f : rs;
}

// Temperature/humidity correction for MQ135 (uses the SHT30)
float mq135Factor(float t, float h) {
  if (t < 20.0f) return 0.00035f * t * t - 0.02718f * t + 1.39538f - (h - 33.0f) * 0.0018f;
  return -0.003333333f * t - 0.001923077f * h + 1.130128205f;
}

// Dust sensor: 280us sample inside a 320us LED pulse, 10 ms period
float readDustVoltage() {
  const int N = 10;
  float sum = 0;
  for (int i = 0; i < N; i++) {
    digitalWrite(PIN_DUST_LED, LOW);
    delayMicroseconds(280);
    sum += analogReadMilliVolts(PIN_DUST_AO);
    delayMicroseconds(40);
    digitalWrite(PIN_DUST_LED, HIGH);
    delayMicroseconds(9680);
  }
  return sum / N / 1000.0f / DIV_RATIO;
}

// ============================ SHT30 ===========================
void i2cScan() {
  Serial.print("I2C scan: ");
  int n = 0;
  for (uint8_t a = 1; a < 127; a++) {
    Wire.beginTransmission(a);
    if (Wire.endTransmission() == 0) { Serial.printf("0x%02X ", a); n++; }
  }
  if (!n) Serial.print("no devices (check SDA/SCL/3V3/GND)");
  Serial.println();
}

bool startSHT() { return sht.begin(0x44) || sht.begin(0x45); }

bool readSHT(float &t, float &h) {
  if (!shtOk) { shtOk = startSHT(); if (!shtOk) return false; }
  float tt = sht.readTemperature(), hh = sht.readHumidity();
  if (isnan(tt) || isnan(hh)) { shtOk = false; return false; }
  t = constrain(tt + TEMP_OFFSET_C, T_MIN, T_MAX);
  h = constrain(hh + RH_OFFSET, H_MIN, H_MAX);
  return true;
}

// ========================== CALIBRATION =======================
void saveCalibration() {
  prefs.putFloat("r135", r0_mq135);
  prefs.putFloat("r7", r0_mq7);
  prefs.putFloat("dust0", dustV0);
  prefs.putInt("ver", CAL_VERSION);
}

// Run in FRESH AIR (open window / outdoors)
void runCalibration() {
  Serial.println("\n=== CALIBRATION: keep sensors in fresh air ===");
  while (millis() < WARMUP_SECONDS * 1000UL) {
    Serial.printf("Warming up... %lu s left\n", WARMUP_SECONDS - millis() / 1000UL);
    digitalWrite(PIN_ALERT_LED, !digitalRead(PIN_ALERT_LED));
    delay(1000);
  }
  float t = 25, h = 50;
  readSHT(t, h);

  const int N = 60;
  double s135 = 0, s7 = 0, sd = 0;
  for (int i = 0; i < N; i++) {
    s135 += calcRs(sensorVolts(PIN_MQ135), MQ135_RL_KOHM) / mq135Factor(t, h);
    s7   += calcRs(sensorVolts(PIN_MQ7), MQ7_RL_KOHM);
    sd   += readDustVoltage();
    delay(100);
  }
  r0_mq135 = (s135 / N) / pow(MQ135_CLEAN_PPM / MQ135_A, 1.0f / MQ135_B);
  r0_mq7   = (s7 / N) / MQ7_CLEAN_RATIO;
  dustV0   = sd / N;
  saveCalibration();
  digitalWrite(PIN_ALERT_LED, LOW);
  Serial.printf("Done. R0_MQ135=%.2f kOhm  R0_MQ7=%.2f kOhm  DustV0=%.3f V\n\n", r0_mq135, r0_mq7, dustV0);
}

// ========================= CLASSIFICATION =====================
int levelCO2(float v) { return v <= 1000 ? 0 : v <= 2000 ? 1 : v <= 5000 ? 2 : 3; }
int levelCO(float v)  { return v <= 9    ? 0 : v <= 35   ? 1 : v <= 100  ? 2 : 3; }
int levelPM(float v)  { return v <= 30   ? 0 : v <= 90   ? 1 : v <= 250  ? 2 : 3; }

const char* comfortTemp(float t) { return t < 18 ? "COLD" : t <= 28 ? "COMFORTABLE" : t <= 35 ? "WARM" : "HOT"; }
const char* comfortRH(float h)   { return h < 30 ? "DRY" : h <= 60 ? "COMFORTABLE" : "HUMID"; }

float ema(float prev, float x, float a = 0.3f) { return isnan(prev) ? x : prev + a * (x - prev); }

void updateAlertLed() {
  static uint32_t last = 0;
  static bool st = false;
  if (level == 0) { digitalWrite(PIN_ALERT_LED, LOW); return; }
  if (level >= 3) { digitalWrite(PIN_ALERT_LED, HIGH); return; }
  uint32_t period = (level == 1) ? 1000 : 300;
  if (millis() - last >= period) { last = millis(); st = !st; digitalWrite(PIN_ALERT_LED, st); }
}

// ============================ WIFI ============================
void postToServer(float t, float h, float co2, float co, float pm) {
#if ENABLE_WIFI
  if (WiFi.status() != WL_CONNECTED) return;
  char body[256];
  snprintf(body, sizeof(body),
           "{\"temperature\":%.2f,\"humidity\":%.2f,\"co2\":%.0f,\"co\":%.2f,\"pm\":%.1f,\"level\":%d}",
           t, h, co2, co, pm, level);
  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(body);
  Serial.printf("POST -> %d\n", code);
  http.end();
#endif
}

// ============================ SETUP ===========================
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=== Smart Air Quality Monitor ===");

  pinMode(PIN_DUST_LED, OUTPUT);  digitalWrite(PIN_DUST_LED, HIGH);  // LED off (active LOW)
  pinMode(PIN_ALERT_LED, OUTPUT); digitalWrite(PIN_ALERT_LED, LOW);
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);   // ~0-3.1 V input range

  Wire.begin(PIN_SDA, PIN_SCL);
  i2cScan();
  shtOk = startSHT();
  Serial.println(shtOk ? "SHT30 OK" : "SHT30 NOT FOUND (using 25C/50% for compensation)");

  prefs.begin("aq", false);
  r0_mq135 = prefs.getFloat("r135", 0);
  r0_mq7   = prefs.getFloat("r7", 0);
  dustV0   = prefs.getFloat("dust0", 0.6f);
  if (prefs.getInt("ver", 0) != CAL_VERSION) { r0_mq135 = 0; r0_mq7 = 0; }  // old calibration is invalid

#if ENABLE_WIFI
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 15000) delay(300);
  Serial.println(WiFi.status() == WL_CONNECTED ? "WiFi connected" : "WiFi failed (continuing offline)");
#endif

  if (r0_mq135 <= 0 || r0_mq7 <= 0) runCalibration();
  else Serial.printf("Loaded calibration: R0_MQ135=%.2f R0_MQ7=%.2f DustV0=%.3f\n", r0_mq135, r0_mq7, dustV0);
}

// ============================ LOOP ============================
void loop() {
  if (Serial.available() && Serial.read() == 'c') runCalibration();
  updateAlertLed();

  static uint32_t lastSample = 0;
  static float co2s = NAN, cos_ = NAN, pms = NAN;
  if (millis() - lastSample < SAMPLE_MS) return;
  lastSample = millis();

  float t = 25, h = 50;
  bool okSht = readSHT(t, h);

  float v135 = sensorVolts(PIN_MQ135);
  float v7   = sensorVolts(PIN_MQ7);
  float vd   = readDustVoltage();

  float rs135 = calcRs(v135, MQ135_RL_KOHM) / mq135Factor(t, h);
  float rs7   = calcRs(v7, MQ7_RL_KOHM);

  float co2 = constrain(MQ135_A * pow(rs135 / r0_mq135, MQ135_B), CO2_MIN, CO2_MAX);
  float co  = constrain(MQ7_A * pow(rs7 / r0_mq7, MQ7_B), CO_MIN, CO_MAX);
  float pm  = constrain(DUST_UG_PER_VOLT * (vd - dustV0), PM_MIN, PM_MAX);

  co2s = ema(co2s, co2);
  cos_ = ema(cos_, co);
  pms  = ema(pms, pm);

  level = max(levelCO2(co2s), max(levelCO(cos_), levelPM(pms)));

#if DEBUG_RAW
  Serial.printf("[raw] MQ135 %.2fV Rs=%.1fk | MQ7 %.2fV Rs=%.1fk | Dust %.3fV (base %.3fV)\n",
                v135, rs135, v7, rs7, vd, dustV0);
#endif
  Serial.printf("T=%.1fC (%s) RH=%.1f%% (%s)%s | CO2~%.0f ppm | CO~%.1f ppm | Dust~%.0f ug/m3 | AIR: %s\n",
                t, comfortTemp(t), h, comfortRH(h), okSht ? "" : " [SHT30 FAIL]",
                co2s, cos_, pms, LEVEL_NAME[level]);

  postToServer(t, h, co2s, cos_, pms);
}
