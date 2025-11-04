// server.js - Backend IoT con Express + Supabase
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3001;

// Inicializar Supabase con service_role key (bypass RLS)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Middleware de seguridad
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());

// Rate limiting global
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por ventana
  message: 'Demasiadas solicitudes, intenta más tarde'
});
app.use(limiter);

// Rate limiting específico para webhook (más permisivo)
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // máximo 10 webhooks por minuto
  message: 'Rate limit excedido en webhook'
});

// ==================== ENDPOINTS ====================

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'IoT Backend ESP8266',
    timestamp: new Date().toISOString()
  });
});

// WEBHOOK: Recibe datos desde ThingSpeak vía ThingHTTP
app.post('/webhook/thingspeak', webhookLimiter, async (req, res) => {
  try {
    // Validar secret header
    const secret = req.headers['x-webhook-secret'];
    if (secret !== process.env.WEBHOOK_SECRET) {
      console.warn('❌ Intento de webhook con secret incorrecto');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { temperature, humidity, created_at } = req.body;

    // Validar datos
    if (temperature === undefined || humidity === undefined) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const temp = parseFloat(temperature);
    const hum = parseFloat(humidity);

    // Validar rangos lógicos
    if (isNaN(temp) || isNaN(hum) || temp < -50 || temp > 100 || hum < 0 || hum > 100) {
      return res.status(400).json({ error: 'Valores fuera de rango' });
    }

    // Insertar en Supabase
    const { data, error } = await supabase
      .from('readings')
      .insert([{
        temperature: temp,
        humidity: hum,
        created_at: created_at || new Date().toISOString(),
        source: 'thingspeak'
      }])
      .select();

    if (error) {
      console.error('❌ Error al insertar en Supabase:', error);
      return res.status(500).json({ error: 'Error al guardar datos' });
    }

    console.log(`✅ Datos guardados: ${temp}°C, ${hum}%`);
    res.status(201).json({ 
      success: true, 
      data: data[0],
      message: 'Datos guardados correctamente'
    });

  } catch (error) {
    console.error('❌ Error en webhook:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET: Obtener últimas N lecturas
app.get('/api/readings', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const maxLimit = 1000;
    
    const { data, error } = await supabase
      .from('readings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, maxLimit));

    if (error) throw error;

    res.json({ 
      success: true, 
      count: data.length,
      data: data.reverse() // Enviar del más antiguo al más reciente
    });

  } catch (error) {
    console.error('❌ Error al obtener lecturas:', error);
    res.status(500).json({ error: 'Error al obtener datos' });
  }
});

// GET: Obtener última lectura
app.get('/api/readings/latest', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('readings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) throw error;

    res.json({ 
      success: true, 
      data 
    });

  } catch (error) {
    console.error('❌ Error al obtener última lectura:', error);
    res.status(500).json({ error: 'Error al obtener datos' });
  }
});

// GET: Estadísticas del día actual
app.get('/api/stats/today', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('readings')
      .select('temperature, humidity')
      .gte('created_at', today.toISOString());

    if (error) throw error;

    if (data.length === 0) {
      return res.json({ 
        success: true, 
        data: {
          count: 0,
          temperature: { min: null, max: null, avg: null },
          humidity: { min: null, max: null, avg: null }
        }
      });
    }

    const temps = data.map(r => parseFloat(r.temperature));
    const hums = data.map(r => parseFloat(r.humidity));

    const stats = {
      count: data.length,
      temperature: {
        min: Math.min(...temps),
        max: Math.max(...temps),
        avg: (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(2)
      },
      humidity: {
        min: Math.min(...hums),
        max: Math.max(...hums),
        avg: (hums.reduce((a, b) => a + b, 0) / hums.length).toFixed(2)
      }
    };

    res.json({ success: true, data: stats });

  } catch (error) {
    console.error('❌ Error al obtener estadísticas:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado' });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('❌ Error no manejado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📊 Supabase URL: ${process.env.SUPABASE_URL}`);
  console.log(`🔒 Webhook secret configurado: ${!!process.env.WEBHOOK_SECRET}`);
});