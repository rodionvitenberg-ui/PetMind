import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Image, ActivityIndicator, Button, Alert, ScrollView } from 'react-native';
// import * as Speech from 'expo-speech'; // Голос пока отключили по просьбе

// 🔥 ВСТАВЬ СЮДА СВОЙ КЛЮЧ GEMINI
const API_KEY = 'AIzaSyB9L_NI-jvpbDh3LJfxm9WeWsWlj8zJP8E'; 

export default function HomeScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  
  // Состояния
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'fun' | 'pro'>('fun'); // 👈 НОВОЕ: Переключатель режимов

  // Данные от ИИ
  const [thought, setThought] = useState(''); // Для режима FUN
  const [animalInfo, setAnimalInfo] = useState<any>(null); // Для режима PRO

  // Права на камеру
  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Дай доступ к камере!</Text>
        <Button onPress={requestPermission} title="Разрешить" />
      </View>
    );
  }

  // --- ГЛАВНАЯ ЛОГИКА ---
  const takePictureAndAnalyze = async () => {
    if (cameraRef.current) {
      try {
        setLoading(true);
        
        // 1. Снимаем
        const photoData = await cameraRef.current.takePictureAsync({
          quality: 0.5,
          base64: true,
        });
        setPhoto(photoData.uri);

        // 2. Готовим Промпт (Зависит от режима!)
        let promptText = "";

        if (mode === 'fun') {
          promptText = "Ты смешной кот (или собака). Посмотри на фото. Придумай одну короткую, язвительную или смешную фразу от первого лица (максимум 12 слов). Не используй кавычки.";
        } else {
          // 🔥 РЕЖИМ ПРОФИ: Просим JSON
          promptText = `Ты опытный ветеринар и зоолог. Посмотри на фото. 
          Если это животное, определи его вид/породу максимально точно.
          Верни ответ СТРОГО в формате JSON без лишних слов и markdown оберток.
          Структура JSON:
          {
            "name": "Название вида/породы (на русском)",
            "food": "Чем питается (кратко, 1 предложение)",
            "fact": "Один интересный факт (1 предложение)",
            "care": "Главный совет по уходу или безопасности"
          }
          Если животного нет, верни JSON: {"error": "Животное не обнаружено"}`;
        }

        const body = {
          contents: [{
            parts: [
              { text: promptText },
              { inlineData: { mimeType: "image/jpeg", data: photoData.base64 } }
            ]
          }]
        };

        // 3. Отправляем в Google
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        const result = await response.json();
        
        if (result.candidates && result.candidates[0].content) {
          const aiText = result.candidates[0].content.parts[0].text;
          
          if (mode === 'fun') {
            setThought(aiText);
          } else {
            // Пытаемся почистить ответ от рамок ```json ... ``` если они есть
            const cleanJson = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
            try {
              const data = JSON.parse(cleanJson);
              setAnimalInfo(data);
            } catch (e) {
              setAnimalInfo({ error: "Ошибка чтения данных. Попробуй еще раз." });
            }
          }
          
        } else {
          setThought("Мяу... (ИИ не ответил)");
        }

      } catch (error) {
        Alert.alert("Ошибка", error.toString());
      } finally {
        setLoading(false);
      }
    }
  };

  const reset = () => {
    setPhoto(null);
    setThought('');
    setAnimalInfo(null);
  };

  // --- ОТРИСОВКА ---
  if (photo) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: photo }} style={styles.camera} />
        
        {loading && (
          <View style={styles.loaderOverlay}>
            <ActivityIndicator size="large" color="#ffcc00" />
            <Text style={styles.loaderText}>
              {mode === 'fun' ? 'Сканирую мысли...' : 'Анализирую ДНК...'}
            </Text>
          </View>
        )}

        {/* РЕЗУЛЬТАТ: FUN MODE */}
        {!loading && mode === 'fun' && thought !== '' && (
          <View style={styles.bubble}>
             <Text style={styles.thoughtText}>{thought}</Text>
          </View>
        )}

        {/* РЕЗУЛЬТАТ: PRO MODE (Карточка) */}
        {!loading && mode === 'pro' && animalInfo && (
          <View style={styles.infoCard}>
             {animalInfo.error ? (
               <Text style={styles.errorText}>{animalInfo.error}</Text>
             ) : (
               <>
                 <Text style={styles.cardTitle}>{animalInfo.name}</Text>
                 <View style={styles.separator} />
                 <Text style={styles.cardLabel}>🍖 Питание:</Text>
                 <Text style={styles.cardText}>{animalInfo.food}</Text>
                 
                 <Text style={styles.cardLabel}>💡 Факт:</Text>
                 <Text style={styles.cardText}>{animalInfo.fact}</Text>
                 
                 <Text style={styles.cardLabel}>❤️ Совет:</Text>
                 <Text style={styles.cardText}>{animalInfo.care}</Text>
               </>
             )}
          </View>
        )}

        {!loading && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.button} onPress={reset}>
              <Text style={styles.text}>🔄 ЕЩЕ РАЗ</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // --- ЭКРАН КАМЕРЫ ---
  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing="back" ref={cameraRef}>
        
        {/* ПЕРЕКЛЮЧАТЕЛЬ РЕЖИМОВ */}
        <View style={styles.topBar}>
          <TouchableOpacity 
            style={[styles.modeBtn, mode === 'fun' && styles.activeMode]} 
            onPress={() => setMode('fun')}
          >
            <Text style={styles.modeText}>🤡 ПРИКОЛ</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.modeBtn, mode === 'pro' && styles.activeMode]} 
            onPress={() => setMode('pro')}
          >
            <Text style={styles.modeText}>🧐 АЛЬМАНАХ</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, mode === 'fun' ? styles.scanBtnFun : styles.scanBtnPro]} 
            onPress={takePictureAndAnalyze}
          >
            <Text style={styles.text}>
              {mode === 'fun' ? '🧠 ЧИТАТЬ МЫСЛИ' : '🔍 СКАНИРОВАТЬ'}
            </Text>
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black', justifyContent: 'center' },
  message: { textAlign: 'center', paddingBottom: 10, color: 'white', fontSize: 18 },
  camera: { flex: 1, width: '100%' },
  
  // Верхняя панель
  topBar: { 
    position: 'absolute', top: 60, alignSelf: 'center', flexDirection: 'row', 
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 30, padding: 5 
  },
  modeBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 25 },
  activeMode: { backgroundColor: 'white' },
  modeText: { fontWeight: 'bold', fontSize: 14 },

  buttonContainer: { position: 'absolute', bottom: 50, alignSelf: 'center', width: '100%', alignItems: 'center' },
  button: { backgroundColor: 'white', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 50, elevation: 5 },
  
  // Разные цвета кнопок
  scanBtnFun: { backgroundColor: '#ffcc00', borderWidth: 2, borderColor: 'white' },
  scanBtnPro: { backgroundColor: '#4CAF50', borderWidth: 2, borderColor: 'white' }, // Зеленая для пользы

  text: { fontSize: 18, fontWeight: 'bold', color: 'black' },
  
  // Пузырь (Fun)
  bubble: { position: 'absolute', top: '20%', alignSelf: 'center', backgroundColor: 'white', padding: 20, borderRadius: 20, borderBottomLeftRadius: 0, maxWidth: '85%', elevation: 8 },
  thoughtText: { fontSize: 18, fontWeight: 'bold', color: '#333', textAlign: 'center' },

  // Карточка (Pro)
  infoCard: { 
    position: 'absolute', top: '15%', alignSelf: 'center', 
    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
    padding: 20, borderRadius: 15, width: '90%', elevation: 10 
  },
  cardTitle: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 10, color: '#2E7D32' },
  separator: { height: 2, backgroundColor: '#eee', marginBottom: 10 },
  cardLabel: { fontSize: 14, color: '#666', marginTop: 5, fontWeight: 'bold' },
  cardText: { fontSize: 16, color: '#333', marginBottom: 5 },
  errorText: { fontSize: 18, color: 'red', textAlign: 'center' },

  loaderOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  loaderText: { color: 'white', marginTop: 20, fontSize: 18, fontWeight: 'bold' }
});