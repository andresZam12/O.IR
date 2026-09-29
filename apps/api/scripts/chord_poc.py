"""
scripts/chord_poc.py — Prueba de concepto: audio → cromagrama → acordes

Este script es independiente de la API. Su único propósito es demostrar
que el pipeline de detección de acordes funciona antes de integrarlo al backend.

Cómo usarlo:
    python scripts/chord_poc.py ruta/al/archivo.mp3

Qué hace:
    1. Carga el archivo de audio con librosa
    2. Calcula el cromagrama (energía de cada nota musical en el tiempo)
    3. Aplica template matching con plantillas de acordes mayores y menores
    4. Imprime los acordes detectados con sus marcas de tiempo y confianza
"""

import sys
import numpy as np
import librosa


# ===================================================
# Plantillas de acordes (12 notas: C, C#, D, D#, E, F, F#, G, G#, A, A#, B)
# Cada plantilla indica qué notas pertenecen al acorde (1 = presente, 0 = ausente)
# ===================================================

# Notas de referencia: C=0, C#=1, D=2, D#=3, E=4, F=5, F#=6, G=7, G#=8, A=9, A#=10, B=11
NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

def build_chord_templates() -> dict[str, np.ndarray]:
    """
    Construye las plantillas binarias para todos los acordes mayores y menores.

    Un acorde mayor se forma con: raíz, tercera mayor (4 semitonos), quinta (7 semitonos)
    Un acorde menor se forma con: raíz, tercera menor (3 semitonos), quinta (7 semitonos)

    Returns:
        Diccionario: nombre del acorde → vector de 12 valores (0 o 1)
    """
    templates = {}

    for root_idx, root_name in enumerate(NOTE_NAMES):
        # --- Acorde mayor ---
        major = np.zeros(12)
        major[root_idx % 12] = 1          # Raíz
        major[(root_idx + 4) % 12] = 1    # Tercera mayor
        major[(root_idx + 7) % 12] = 1    # Quinta justa
        templates[f"{root_name}"] = major

        # --- Acorde menor ---
        minor = np.zeros(12)
        minor[root_idx % 12] = 1          # Raíz
        minor[(root_idx + 3) % 12] = 1    # Tercera menor
        minor[(root_idx + 7) % 12] = 1    # Quinta justa
        templates[f"{root_name}m"] = minor

    return templates


def detect_chords(audio_path: str, hop_length: int = 4096) -> list[dict]:
    """
    Detecta acordes en un archivo de audio usando cromagrama + template matching.

    El cromagrama mide la energía de cada una de las 12 notas musicales
    en ventanas de tiempo. Luego se compara cada ventana con las plantillas
    de acordes conocidos y se elige la más parecida.

    Args:
        audio_path: Ruta al archivo de audio (.mp3, .wav, etc.)
        hop_length:  Tamaño del salto entre ventanas (mayor = menos resolución temporal).

    Returns:
        Lista de diccionarios con: time (segundos), chord (nombre), confidence (0-1)
    """

    print(f"\n🎵 Cargando audio: {audio_path}")

    # --- Cargar el audio (mono, frecuencia de muestreo original) ---
    audio, sample_rate = librosa.load(audio_path, mono=True)
    duration = librosa.get_duration(y=audio, sr=sample_rate)
    print(f"   Duración: {duration:.1f}s | Sample rate: {sample_rate} Hz")

    # --- Calcular el cromagrama ---
    # chroma_cqt usa la Constant-Q Transform, más precisa que la FFT para música
    print("🎼 Calculando cromagrama...")
    chromagram = librosa.feature.chroma_cqt(y=audio, sr=sample_rate, hop_length=hop_length)
    # Forma del cromagrama: (12 notas, N ventanas de tiempo)

    # --- Construir plantillas de acordes ---
    templates = build_chord_templates()

    # --- Calcular el tiempo de cada ventana ---
    times = librosa.frames_to_time(np.arange(chromagram.shape[1]), sr=sample_rate, hop_length=hop_length)

    # --- Template matching: comparar cada frame con cada acorde ---
    print("🔍 Aplicando template matching...")
    detected_chords = []

    for frame_idx, time in enumerate(times):
        frame = chromagram[:, frame_idx]

        # Evitar frames silenciosos (energía muy baja)
        if frame.max() < 0.1:
            continue

        # Normalizar el frame para que los valores estén entre 0 y 1
        frame_normalized = frame / (frame.max() + 1e-8)

        best_chord = "N/C"    # N/C = No Chord
        best_score = -1.0

        # Comparar con cada plantilla de acorde usando producto punto (cosine similarity)
        for chord_name, template in templates.items():
            score = float(np.dot(frame_normalized, template) / (np.linalg.norm(template) + 1e-8))
            if score > best_score:
                best_score = score
                best_chord = chord_name

        detected_chords.append({
            "time": round(float(time), 2),
            "chord": best_chord,
            "confidence": round(best_score, 3),
        })

    return detected_chords


def compress_chord_sequence(chords: list[dict]) -> list[dict]:
    """
    Comprime la secuencia de acordes eliminando repeticiones consecutivas.
    Si el acorde no cambia entre frames, solo se conserva la primera aparición.

    Args:
        chords: Lista de acordes detectados frame a frame.

    Returns:
        Lista comprimida con solo los cambios de acorde.
    """
    if not chords:
        return []

    compressed = [chords[0]]

    for chord in chords[1:]:
        # Solo agregar si el acorde cambió respecto al anterior
        if chord["chord"] != compressed[-1]["chord"]:
            compressed.append(chord)

    return compressed


def main():
    """Función principal del script de prueba de concepto."""

    # Verificar que se pasó un archivo como argumento
    if len(sys.argv) < 2:
        print("Uso: python scripts/chord_poc.py <ruta_al_audio>")
        print("Ejemplo: python scripts/chord_poc.py test.mp3")
        sys.exit(1)

    audio_path = sys.argv[1]

    # --- Detección de acordes ---
    chords = detect_chords(audio_path)

    # --- Comprimir la secuencia (eliminar repeticiones) ---
    unique_chords = compress_chord_sequence(chords)

    # --- Mostrar resultados ---
    print(f"\n✅ Acordes detectados ({len(unique_chords)} cambios):\n")
    print(f"{'Tiempo':>8}  {'Acorde':<6}  {'Confianza':>10}")
    print("-" * 32)

    for entry in unique_chords:
        print(f"{entry['time']:>7.2f}s  {entry['chord']:<6}  {entry['confidence']:>10.3f}")

    # --- Resumen ---
    unique_names = list(set(c["chord"] for c in unique_chords))
    print(f"\n📊 Acordes únicos encontrados: {', '.join(sorted(unique_names))}")
    print(f"   Total de cambios: {len(unique_chords)}")


if __name__ == "__main__":
    main()
