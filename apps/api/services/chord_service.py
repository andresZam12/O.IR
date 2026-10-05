"""
services/chord_service.py — Servicio de detección de acordes y estimación de tonalidad

Implementa la lógica de procesamiento de señales de audio musical:
1. Carga y preprocesamiento de audio con librosa.
2. Extracción de cromagrama basado en Constant-Q Transform (chroma_cqt).
3. Template matching con plantillas armónicas de acordes mayores y menores.
4. Compresión temporal de acordes consecutivos.
5. Estimación de la tonalidad global (Key Estimation) usando perfiles armónicos.
"""

from typing import Optional
import numpy as np
import librosa

from schemas.song import ChordItem, ChordDetectionResult


class ChordDetectionService:
    """
    Servicio de dominio para el análisis armónico de audios.
    Permite detectar la progresión de acordes y estimar la tonalidad principal.
    """

    NOTE_NAMES: list[str] = [
        "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"
    ]

    # Perfiles tonales de Krumhansl-Schmuckler para estimar la tonalidad de la canción
    # Reflejan la jerarquía de estabilidad de las 12 alturas musicales en modo mayor y menor
    MAJOR_PROFILE: np.ndarray = np.array(
        [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
    )
    MINOR_PROFILE: np.ndarray = np.array(
        [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
    )

    def __init__(self, hop_length: int = 4096, min_energy_threshold: float = 0.1) -> None:
        """
        Inicializa el servicio de detección.

        Args:
            hop_length: Tamaño del salto entre ventanas de análisis (resolución temporal).
            min_energy_threshold: Umbral mínimo de energía cromática para descartar silencios.
        """
        self.hop_length = hop_length
        self.min_energy_threshold = min_energy_threshold
        self._templates = self._build_chord_templates()

    def _build_chord_templates(self) -> dict[str, np.ndarray]:
        """
        Construye las plantillas binarias de 12 clases de altura (pitch classes)
        para todos los acordes mayores y menores.

        Returns:
            Diccionario que mapea el nombre del acorde a su vector de 12 componentes.
        """
        templates: dict[str, np.ndarray] = {}

        for root_idx, root_name in enumerate(self.NOTE_NAMES):
            # --- Acorde Mayor (Raíz, Tercera Mayor: +4 semitonos, Quinta Justa: +7) ---
            major = np.zeros(12, dtype=np.float32)
            major[root_idx % 12] = 1.0
            major[(root_idx + 4) % 12] = 1.0
            major[(root_idx + 7) % 12] = 1.0
            templates[root_name] = major

            # --- Acorde Menor (Raíz, Tercera Menor: +3 semitonos, Quinta Justa: +7) ---
            minor = np.zeros(12, dtype=np.float32)
            minor[root_idx % 12] = 1.0
            minor[(root_idx + 3) % 12] = 1.0
            minor[(root_idx + 7) % 12] = 1.0
            templates[f"{root_name}m"] = minor

        return templates

    def detect_chords_from_file(self, audio_path: str) -> ChordDetectionResult:
        """
        Ejecuta el pipeline completo de detección de acordes desde una ruta de archivo.

        Args:
            audio_path: Ruta al archivo de audio en disco (.mp3, .wav, etc.).

        Returns:
            ChordDetectionResult con la secuencia comprimida, acordes únicos y tonalidad.
        """
        # 1. Cargar audio en mono con frecuencia nativa
        audio, sample_rate = librosa.load(audio_path, mono=True)
        duration = float(librosa.get_duration(y=audio, sr=sample_rate))

        return self.detect_chords_from_audio(audio, sample_rate, duration)

    def detect_chords_from_audio(
        self, audio: np.ndarray, sample_rate: int, duration: float
    ) -> ChordDetectionResult:
        """
        Procesa el arreglo de audio en memoria y extrae acordes y tonalidad.

        Args:
            audio: Señal de audio 1D (mono).
            sample_rate: Frecuencia de muestreo (Hz).
            duration: Duración en segundos.

        Returns:
            Instancia de ChordDetectionResult con el análisis armónico completo.
        """
        # Si el audio es demasiado corto o vacío, retornar resultado seguro
        if len(audio) == 0 or duration <= 0:
            return ChordDetectionResult(
                duration=0.0,
                chords=[],
                unique_chords=[],
                total_changes=0,
                estimated_key=None,
            )

        # 2. Calcular cromagrama con Constant-Q Transform (más sensible a frecuencias musicales)
        chromagram = librosa.feature.chroma_cqt(
            y=audio, sr=sample_rate, hop_length=self.hop_length
        )

        # 3. Vector de tiempos para cada ventana analizada
        times = librosa.frames_to_time(
            np.arange(chromagram.shape[1]), sr=sample_rate, hop_length=self.hop_length
        )

        # 4. Template matching frame a frame
        raw_chords: list[ChordItem] = []
        for frame_idx, time in enumerate(times):
            frame = chromagram[:, frame_idx]

            # Si el frame es silencio o ruido casi imperceptible
            if frame.max() < self.min_energy_threshold:
                continue

            # Normalización del frame
            frame_norm = frame / (frame.max() + 1e-8)

            best_chord = "N/C"
            best_score = -1.0

            # Comparación con cada plantilla mediante producto punto normalizado (cosine similarity)
            for chord_name, template in self._templates.items():
                denom = (np.linalg.norm(frame_norm) * np.linalg.norm(template)) + 1e-8
                score = float(np.dot(frame_norm, template) / denom)
                if score > best_score:
                    best_score = score
                    best_chord = chord_name

            raw_chords.append(
                ChordItem(
                    time=round(float(time), 2),
                    chord=best_chord,
                    confidence=round(max(0.0, min(1.0, best_score)), 3),
                )
            )

        # 5. Comprimir acordes consecutivos repetidos
        compressed_chords = self._compress_chord_sequence(raw_chords)

        # 6. Acordes únicos encontrados
        unique_chords = sorted(
            list(set(item.chord for item in compressed_chords if item.chord != "N/C"))
        )

        # 7. Estimación de tonalidad global a partir de la suma de cromas
        estimated_key = self._estimate_key(chromagram)

        return ChordDetectionResult(
            duration=round(duration, 2),
            chords=compressed_chords,
            unique_chords=unique_chords,
            total_changes=len(compressed_chords),
            estimated_key=estimated_key,
        )

    def _compress_chord_sequence(self, chords: list[ChordItem]) -> list[ChordItem]:
        """
        Elimina redundancias consecutivas: si un acorde se mantiene en varios
        frames consecutivos, solo se conserva el inicio del cambio de acorde.
        """
        if not chords:
            return []

        compressed: list[ChordItem] = [chords[0]]

        for chord in chords[1:]:
            if chord.chord != compressed[-1].chord:
                compressed.append(chord)

        return compressed

    def _estimate_key(self, chromagram: np.ndarray) -> Optional[str]:
        """
        Estima la tonalidad global de la canción utilizando correlación cruzada
        del vector cromático promedio con los perfiles de Krumhansl-Schmuckler.
        """
        if chromagram.size == 0:
            return None

        # Vector de cromas promedio a lo largo de toda la canción (12 notas)
        chroma_sum = np.sum(chromagram, axis=1)
        if chroma_sum.max() == 0:
            return None

        chroma_avg = chroma_sum / (np.linalg.norm(chroma_sum) + 1e-8)

        best_score = -1.0
        best_key = None

        # Comparar las 12 rotaciones posibles en Mayor y Menor
        for i, note in enumerate(self.NOTE_NAMES):
            # Rotar los perfiles tonales hacia la nota evaluada
            major_rot = np.roll(self.MAJOR_PROFILE, i)
            minor_rot = np.roll(self.MINOR_PROFILE, i)

            major_rot /= np.linalg.norm(major_rot) + 1e-8
            minor_rot /= np.linalg.norm(minor_rot) + 1e-8

            major_score = float(np.dot(chroma_avg, major_rot))
            minor_score = float(np.dot(chroma_avg, minor_rot))

            if major_score > best_score:
                best_score = major_score
                best_key = f"{note} Major"

            if minor_score > best_score:
                best_score = minor_score
                best_key = f"{note} Minor"

        return best_key
